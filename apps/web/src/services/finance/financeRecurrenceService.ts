import type { FinancialEntry, FinancialRecurrence, Id } from "@gestarahub/contracts";
import { addCompetence, materializeRecurrence, recurrenceDueDate } from "@gestarahub/core/finance";
import { plural } from "@gestarahub/core/format";
import { financialEntryTypeLabel } from "@/lib/labels";
import { newId, notFoundError, nowIso, simulateWrite } from "@/mocks/helpers";
import { persist, store } from "@/mocks/store";
import { auditLogService } from "../auditLogService";
import { ensureMembershipCharges } from "../billingService";
import { applyRecurringAutoPayments } from "../onlinePaymentsService";
import { conflict, currentCompetence, todayISO } from "./financeHelpers";

// --- Recorrencia (materializacao idempotente) -------------------------------

export function recurrenceEntry(r: FinancialRecurrence, competence: string, ts: string): FinancialEntry {
  return {
    id: newId(),
    organizationId: r.organizationId,
    unitId: store.unit.id,
    type: r.type,
    categoryId: r.categoryId,
    description: r.description,
    amountCents: r.amountCents,
    dueDate: recurrenceDueDate(r, competence),
    status: "pending",
    recurrenceId: r.id,
    recurrenceCompetence: competence,
    createdAt: ts,
    updatedAt: ts,
  };
}

/** Demonstracao: cria no store os lancamentos que faltam de cada recorrencia ativa. Devolve quantos criou. */
export async function materializeAllAsync(): Promise<number> {
  const upTo = addCompetence(currentCompetence(), 1);
  const ts = nowIso();
  const newEntries: FinancialEntry[] = [];
  for (const r of store.financialRecurrences) {
    if (r.organizationId !== store.organization.id) continue;
    const existing = store.financialEntries
      .filter((e) => e.organizationId === store.organization.id && e.recurrenceId === r.id && e.recurrenceCompetence)
      .map((e) => e.recurrenceCompetence!);
    for (const competence of materializeRecurrence(r, existing, upTo)) {
      const entry = recurrenceEntry(r, competence, ts);
      store.financialEntries.push(entry);
      newEntries.push(entry);
    }
  }
  return newEntries.length;
}

/** Garante a materializacao numa leitura (persiste so se criou algo). */
export async function ensureMaterialized(competence?: string): Promise<void> {
  // Mensalidades do mes (e do mes consultado, se ja chegou) geradas na leitura,
  // sem depender de alguem abrir Cobrancas.
  await ensureMembershipCharges(competence);
  // Pix Automatico antes de ler: o Resumo nao depende de alguem abrir Cobrancas.
  applyRecurringAutoPayments();
  await ensureRecurrenceEntries();
}

/**
 * Lancamentos das recorrencias. Conta real: no servidor
 * (`materializeRecurrencesAction`, protegido contra duplicata) e trazidos do
 * banco; o navegador nao cria mais. Demonstracao: no store, como antes.
 */
export async function ensureRecurrenceEntries(): Promise<void> {
  const created = await materializeAllAsync();
  if (created > 0) persist();
}

export const financeRecurrenceService = {
  /** Encerra a repeticao: inativa e cancela os pendentes com vencimento de hoje em diante. */
  endRecurrence(recurrenceId: Id): Promise<{ canceled: number }> {
    return simulateWrite(async () => {
      const recurrence = store.financialRecurrences.find((r) => r.id === recurrenceId);
      if (!recurrence) throw notFoundError("Repetição não encontrada.");
      if (recurrence.status !== "active") throw conflict("Esta repetição já foi encerrada.");
      const ts = nowIso();
      const today = todayISO();
      recurrence.status = "inactive";
      recurrence.endCompetence = currentCompetence();
      recurrence.updatedAt = ts;

      let canceled = 0;
      for (const e of store.financialEntries) {
        if (e.recurrenceId !== recurrenceId || e.status !== "pending" || e.dueDate < today) continue;
        e.status = "canceled";
        e.updatedAt = ts;
        canceled += 1;
      }

      auditLogService.record({
        action: "inactivated",
        target: { type: "financial_entry", id: recurrence.id, label: recurrence.description },
        predicate: `encerrou a repetição mensal da ${financialEntryTypeLabel(recurrence.type).toLowerCase()} ${recurrence.description}${canceled > 0 ? ` e cancelou ${plural(canceled, "lançamento pendente", "lançamentos pendentes")}` : ""}`,
      });
      return { canceled };
    });
  },
};
