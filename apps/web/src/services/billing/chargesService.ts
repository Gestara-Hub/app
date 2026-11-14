import type {
  Charge,
  ChargeFilter,
  ChargeView,
  CreateExtraCharge,
  Id,
  PaginatedResult,
} from "@gestarahub/contracts";
import { paginateArray } from "@gestarahub/contracts";
import { describeCharge, splitInstallments } from "@gestarahub/core/billing";
import { formatCents, plural } from "@gestarahub/core/format";
import { store } from "@/services/world/store";
import { newId, nowIso, readOp, writeOp, validationError, persistLocal } from "@/services/world/ops";
import { auditLogService } from "../audit/auditLogService";
import { applyRecurringAutoPayments } from "../onlinePayments";
import { clone, competenceLabel, todayISO } from "./billingHelpers";
import { validateExtraCharge } from "./billingValidation";
import { toChargeView } from "./billingViews";
import { ensureMembershipCharges, generateMembershipChargesFor } from "./membershipCharges";

export const chargesService = {
  /**
   * Alunos com alguma cobranca vencida, de qualquer tipo (etiqueta "Em atraso"
   * na lista de Alunos, decisao 10A do teste geral). So os ids: a lista de
   * alunos nao carrega as cobrancas. Le sem gerar nada (as mensalidades nascem
   * na rotina diaria e na tela de Cobrancas).
   */
  listOverdueStudentIds(): Promise<Id[]> {
    return readOp(async () => {
      const today = todayISO();
      const ids = new Set<Id>();
      for (const c of store.charges) {
        if ((c.status === "pending" || c.status === "overdue") && c.dueDate < today) ids.add(c.studentId);
      }
      return [...ids];
    });
  },

  // --- Cobrancas (Charges) ------------------------------------------------
  listCharges(filter?: ChargeFilter): Promise<ChargeView[]> {
    return readOp(async () => {
      // Mensalidades do mes atual (e do mes consultado, se ja chegou) nascem sozinhas;
      // na conta real, no servidor, e ja chegam sincronizadas.
      await ensureMembershipCharges(filter?.competence);
      // Pix Automatico: paga na leitura o que venceu dentro do limite.
      applyRecurringAutoPayments();
      // Se um aluno saiu da aula avulsa e foi readicionado na mesma aula antes,
      // remove a cobranca encerrada duplicada daquela sessao.
      const activeDropinSessions = new Set(
        store.charges
          .filter((c) => c.kind === "dropin" && c.sessionId && c.status !== "canceled")
          .map((c) => `${c.studentId}_${c.sessionId}`),
      );
      if (activeDropinSessions.size > 0) {
        const beforeLen = store.charges.length;
        const toDelete: Id[] = [];
        store.charges = store.charges.filter((c) => {
          const dropinDup =
            c.kind === "dropin" &&
            c.sessionId &&
            c.status === "canceled" &&
            c.canceledBy === "system" &&
            activeDropinSessions.has(`${c.studentId}_${c.sessionId}`);
          if (dropinDup) toDelete.push(c.id);
          return !dropinDup;
        });
        if (store.charges.length !== beforeLen) {
          persistLocal();
        }
      }
      let result = store.charges.map(toChargeView);
      if (filter?.competence) {
        result = result.filter((c) => c.competence === filter.competence);
      }
      if (filter?.kind) result = result.filter((c) => c.kind === filter.kind);
      if (filter?.status) result = result.filter((c) => c.status === filter.status);
      if (filter?.eventId) result = result.filter((c) => c.eventId === filter.eventId);
      if (filter?.studentId) {
        result = result.filter((c) => c.studentId === filter.studentId);
      }
      return clone(
        result.sort(
          (a, b) =>
            a.studentName.localeCompare(b.studentName, "pt-BR") ||
            a.dueDate.localeCompare(b.dueDate),
        ),
      );
    });
  },

  listChargesPaginated(filter?: ChargeFilter): Promise<PaginatedResult<ChargeView>> {
    return readOp(async () => {
      await ensureMembershipCharges(filter?.competence);
      applyRecurringAutoPayments();

      let result = store.charges.map(toChargeView);
      if (filter?.competence) {
        result = result.filter((c) => c.competence === filter.competence);
      }
      if (filter?.kind) result = result.filter((c) => c.kind === filter.kind);
      if (filter?.status) result = result.filter((c) => c.status === filter.status);
      if (filter?.eventId) result = result.filter((c) => c.eventId === filter.eventId);
      if (filter?.studentId) {
        result = result.filter((c) => c.studentId === filter.studentId);
      }

      const sorted = result.sort(
        (a, b) =>
          a.studentName.localeCompare(b.studentName, "pt-BR") ||
          a.dueDate.localeCompare(b.dueDate),
      );
      return clone(paginateArray(sorted, filter?.page, filter?.pageSize));
    });
  },

  /**
   * Gera as mensalidades que vencem na competencia (`YYYY-MM`) para cada aluno
   * ativo com plano, pela regra de cobranca dele. Idempotente: um periodo de
   * uso nunca gera duas cobrancas (inclusive a 1a, criada no cadastro).
   */
  generateCharges(competence: string): Promise<{ created: number }> {
    return writeOp(async () => {
      const created = generateMembershipChargesFor(competence);

      if (created > 0) {
        auditLogService.record({
          action: "created",
          target: { type: "charge", label: `Competência ${competenceLabel(competence)}` },
          predicate: `gerou ${plural(created, "mensalidade", "mensalidades")} da competência ${competenceLabel(competence)}`,
        });
      }
      return { created };
    });
  },

  /**
   * Cobranca avulsa (taxa de matricula, material, uniforme, exame, evento),
   * a vista ou em ate 12 parcelas mensais. Cada parcela e uma `Charge` "extra"
   * em aberto, na competencia do proprio vencimento, ligadas pelo
   * `installmentGroupId`. Nao passa pelo motor de mensalidades.
   */
  createExtraCharge(payload: CreateExtraCharge): Promise<ChargeView[]> {
    return writeOp(async () => {
      validateExtraCharge(payload);
      const student = store.clients.find((c) => c.id === payload.studentId);
      if (!student) {
        throw validationError([{ field: "studentId", message: "Aluno não encontrado." }]);
      }
      if (student.status !== "active") {
        throw validationError([
          { field: "studentId", message: "Aluno inativo. Reative o cadastro para lançar a cobrança." },
        ]);
      }
      const description = payload.description.trim();
      const parts = splitInstallments(payload.totalCents, payload.installments, payload.firstDueDate);
      const isSplit = parts.length > 1;
      const groupId = isSplit ? newId() : undefined;
      const ts = nowIso();
      const created: Charge[] = parts.map((part) => ({
        id: newId(),
        organizationId: store.organization.id,
        unitId: store.unit.id,
        studentId: student.id,
        kind: "extra",
        description,
        installmentGroupId: groupId,
        competence: part.dueDate.slice(0, 7),
        dueDate: part.dueDate,
        amountCents: part.amountCents,
        status: "pending",
        cycleIndex: isSplit ? part.index : undefined,
        cycleTotal: isSplit ? part.total : undefined,
        createdAt: ts,
        updatedAt: ts,
      }));
      store.charges.push(...created);
      auditLogService.record({
        action: "created",
        target: {
          type: "charge",
          id: created[0].id,
          label: describeCharge({ kind: "extra", description }, student.name),
        },
        predicate: `lançou a cobrança avulsa "${description}" para ${student.name} (${formatCents(payload.totalCents)}${isSplit ? `, em ${parts.length} parcelas` : ""})`,
      });
      return clone(created.map(toChargeView));
    });
  },

  /**
   * Remove as mensalidades em aberto ou canceladas da competencia, para gerar de
   * novo. Pagas nunca sao apagadas (sao registro de recebimento) e aulas
   * avulsas ficam (nao sao recriadas pela geracao).
   */
  clearCharges(competence: string): Promise<{ deleted: number; keptPaid: number }> {
    return writeOp(async () => {
      const inCompetence = store.charges.filter(
        (c) => c.kind === "membership" && c.competence === competence,
      );
      const keptPaid = inCompetence.filter((c) => c.status === "paid").length;
      const removed = new Set(inCompetence.filter((c) => c.status !== "paid").map((c) => c.id));
      store.charges = store.charges.filter((c) => !removed.has(c.id));
      const deleted = removed.size;
      if (deleted > 0) {
        auditLogService.record({
          action: "deleted",
          target: { type: "charge", label: `Competência ${competenceLabel(competence)}` },
          predicate: `removeu ${plural(deleted, "mensalidade em aberto ou cancelada", "mensalidades em aberto ou canceladas")} da competência ${competenceLabel(competence)}`,
          security: true,
        });
      }
      return { deleted, keptPaid };
    });
  },
};
