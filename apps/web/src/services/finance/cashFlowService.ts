import type {
  ChargeKind,
  FinanceCategoryTotal,
  FinanceEntryView,
  FinanceMonthPoint,
  FinanceSummary,
  FinanceUpcomingItem,
  FinancialEntryFilter,
} from "@gestarahub/contracts";
import {
  competenceOf,
  lastCompetences,
  summarizeByCategory,
  summarizeCashFlow,
  summarizeOverdueToDate,
  summarizeMonthlySeries,
} from "@gestarahub/core/finance";
import { addDays, format, parseISO } from "date-fns";
import { readOp, textIncludes } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { cashFlowItems, chargeCompetence, onlineFeesInCompetence, openPreviews, professionalName } from "./cashFlowSources";
import { clone, currentCompetence, monthName, todayISO } from "./financeHelpers";
import { ensureMaterialized } from "./financeRecurrenceService";
import { categoryName, systemCategoryId } from "./financeStore";
import { CHARGE_ROW_TITLE, chargeAggregateRow, payoutRow, toEntryView } from "./financeViews";

export const cashFlowService = {
  /** Cartoes do Resumo da competencia (fontes da secao 4.1; atrasado conforme secao 14). */
  getSummary(competence: string): Promise<FinanceSummary> {
    return readOp(async () => {
      await ensureMaterialized(competence);
      const items = cashFlowItems();
      const summary = summarizeCashFlow(items, competence, todayISO());
      // Bolsas: diferenca entre o valor do plano e o cobrado (inclui isentos).
      const withScholarship = store.charges.filter(
        (c) =>
          c.kind === "membership" &&
          c.status !== "canceled" &&
          c.scholarshipPercent !== undefined &&
          chargeCompetence(c) === competence,
      );
      const scholarshipGrantedCents = withScholarship.reduce(
        (sum, c) => sum + Math.max(0, (c.listAmountCents ?? c.amountCents) - c.amountCents),
        0,
      );
      return {
        ...summary,
        onlineFeesPaidCents: onlineFeesInCompetence(competence).totalCents,
        scholarshipGrantedCents,
        scholarshipStudents: new Set(withScholarship.map((c) => c.studentId)).size,
        // Mes atual: o atraso de meses anteriores continua devido (acumula).
        ...(competence === currentCompetence()
          ? { overdueToDate: summarizeOverdueToDate(items, todayISO()) }
          : {}),
      };
    });
  },

  /** Entradas x saidas pagas nos ultimos `months` meses, terminando em `endCompetence`. */
  getMonthlySeries(months = 6, endCompetence: string = currentCompetence()): Promise<FinanceMonthPoint[]> {
    return readOp(async () => {
      await ensureMaterialized();
      return summarizeMonthlySeries(cashFlowItems(), lastCompetences(endCompetence, months));
    });
  },

  /** Totais pagos por categoria na competencia, com percentual. */
  getByCategory(competence: string): Promise<FinanceCategoryTotal[]> {
    return readOp(async () => {
      await ensureMaterialized();
      return summarizeByCategory(cashFlowItems(), store.financialCategories, competence);
    });
  },

  /**
   * Proximos vencimentos (contas a pagar e pagamentos de professores fechados)
   * ate `days` dias a partir de hoje. Inclui os ja vencidos em aberto (overdue).
   */
  getUpcoming(days = 7): Promise<FinanceUpcomingItem[]> {
    return readOp(async () => {
      await ensureMaterialized();
      const today = todayISO();
      const limit = format(addDays(parseISO(today), days), "yyyy-MM-dd");
      const items: FinanceUpcomingItem[] = [];
      for (const e of store.financialEntries) {
        if (e.type !== "expense" || e.status !== "pending" || e.dueDate > limit) continue;
        items.push({
          id: e.id,
          source: "entry",
          description: e.description,
          amountCents: e.amountCents,
          dueDate: e.dueDate,
          overdue: e.dueDate < today,
        });
      }
      for (const p of store.teacherPayouts) {
        if (p.status !== "closed" || p.dueDate > limit || p.totalCents <= 0) continue;
        items.push({
          id: p.id,
          source: "teacher_payout",
          description: `Pagamento de ${professionalName(p.professionalId)} (${monthName(p.competence)})`,
          amountCents: p.totalCents,
          dueDate: p.dueDate,
          overdue: p.dueDate < today,
        });
      }
      for (const p of openPreviews()) {
        if (p.dueDate > limit) continue;
        items.push({
          id: `preview:${p.professionalId}:${p.competence}`,
          source: "teacher_payout",
          description: `Pagamento de ${p.professionalName} (${monthName(p.competence)}, prévia)`,
          amountCents: p.totalCents,
          dueDate: p.dueDate,
          overdue: p.dueDate < today,
        });
      }
      return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.description.localeCompare(b.description, "pt-BR"));
    });
  },

  /**
   * Lista unificada do mes: agregados das cobrancas dos alunos (uma linha por
   * kind, D7), pagamentos de professores fechados/pagos e lancamentos manuais.
   */
  listEntries(filter?: FinancialEntryFilter): Promise<FinanceEntryView[]> {
    return readOp(async () => {
      await ensureMaterialized(filter?.competence);
      const competence = filter?.competence ?? currentCompetence();
      const today = todayISO();
      const rows: FinanceEntryView[] = [];

      const charges = store.charges.filter((c) => chargeCompetence(c) === competence);
      // Todo kind de cobranca (CHARGE_ROW_TITLE), inclusive "event": a lista fixa
      // deixou as inscricoes de evento fora e o total nao batia com o Resumo (11/11/2026).
      for (const kind of Object.keys(CHARGE_ROW_TITLE) as ChargeKind[]) {
        const row = chargeAggregateRow(kind, competence, charges.filter((c) => c.kind === kind));
        if (row) rows.push(row);
      }
      for (const p of store.teacherPayouts) {
        if (competenceOf(p.dueDate) !== competence) continue;
        const row = payoutRow(p);
        if (row) rows.push(row);
      }
      // Previa do professor (mes ainda nao fechado): o Resumo ja conta como a
      // pagar, entao Lancamentos mostra tambem (antes os totais nao batiam).
      const teachers = systemCategoryId("teachers");
      for (const p of openPreviews()) {
        if (competenceOf(p.dueDate) !== competence) continue;
        rows.push({
          id: `preview:${p.professionalId}:${p.competence}`,
          source: "teacher_payout",
          type: "expense",
          categoryId: teachers,
          categoryName: categoryName(teachers, "Professores"),
          description: `Pagamento de ${p.professionalName} (${monthName(p.competence)}, prévia)`,
          amountCents: p.totalCents,
          dueDate: p.dueDate,
          status: p.dueDate < today ? "overdue" : "pending",
          professionalId: p.professionalId,
        });
      }
      // Taxas do pagamento online do mes, numa linha so (saida automatica, 01/11/2026).
      const fees = onlineFeesInCompetence(competence);
      if (fees.totalCents > 0) {
        const onlineFees = systemCategoryId("online_fees");
        rows.push({
          id: `online_fees:${competence}`,
          source: "online_fee",
          type: "expense",
          categoryId: onlineFees,
          categoryName: categoryName(onlineFees, "Taxas de pagamento online"),
          description: `Taxas de pagamento online de ${monthName(competence)}`,
          amountCents: fees.totalCents,
          dueDate: fees.lastPaidAt!.slice(0, 10),
          status: "paid",
          paidAt: fees.lastPaidAt,
          onlinePaymentCount: fees.count,
        });
      }
      for (const e of store.financialEntries) {
        if (competenceOf(e.dueDate) === competence) rows.push(toEntryView(e, today));
      }

      let result = rows;
      if (filter?.type) result = result.filter((r) => r.type === filter.type);
      if (filter?.status) {
        const wanted = filter.status;
        result = result.filter((r) =>
          r.source === "charge" && r.chargeCounts
            ? wanted === "paid"
              ? r.chargeCounts.paid > 0
              : wanted === "pending"
                ? r.chargeCounts.pending > 0
                : wanted === "overdue"
                  ? r.chargeCounts.overdue > 0
                  : false
            : r.status === wanted,
        );
      }
      if (filter?.categoryId) result = result.filter((r) => r.categoryId === filter.categoryId);
      if (filter?.search?.trim()) {
        const term = filter.search;
        result = result.filter(
          (r) => textIncludes(r.description, term) || textIncludes(r.categoryName, term),
        );
      }

      const sourceOrder = { charge: 0, online_fee: 1, teacher_payout: 2, entry: 3 } as const;
      return clone(
        result.sort(
          (a, b) =>
            sourceOrder[a.source] - sourceOrder[b.source] ||
            a.dueDate.localeCompare(b.dueDate) ||
            a.description.localeCompare(b.description, "pt-BR"),
        ),
      );
    });
  },
};
