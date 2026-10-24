import type {
  Id,
  TeacherPayout,
  TeacherPayoutAdjustment,
  TeacherPayoutLine,
  TeacherPayoutView,
} from "@gestarahub/contracts";
import { teamWords } from "@/services/world/nouns";
import { computeTeacherPayout, isRuleEffective, payoutTotalCents } from "@gestarahub/core/finance";
import { formatCents, pluralWord } from "@gestarahub/core/format";
import { newId, notFoundError, nowIso, readOp, writeOp, validationError } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { auditLogService } from "../audit/auditLogService";
import { buildFacts, factsFor, percentChargeIds, sessionsIn } from "./teacherPayFacts";
import {
  adjustmentLines,
  clone,
  competenceLabel,
  conflict,
  currentCompetence,
  findPayout,
  formatSignedCents,
  isCompetence,
  lineDifference,
  payoutLabel,
  payoutOf,
  professionalName,
  ruleOf,
} from "./teacherPayHelpers";
import { latePaymentShare } from "./teacherPayLatePayments";
import { normalizeAdjustments } from "./teacherPayValidation";
import { buildView, dueDateOf, toDetailSession, type TeacherPayoutDetail } from "./teacherPayViews";

export const teacherPayClosingService = {
  /**
   * Meses dos professores na competencia: com regra vigente (previa ao vivo) ou
   * com o mes ja fechado/pago (congelado, mesmo com o professor inativo).
   */
  listPayouts(competence: string): Promise<TeacherPayoutView[]> {
    return readOp(async () => {
      const facts = buildFacts(competence);
      const ids = new Set<Id>([
        ...store.teacherPayRules.map((r) => r.professionalId),
        ...store.teacherPayouts
          .filter((p) => p.competence === competence)
          .map((p) => p.professionalId),
      ]);
      const views: TeacherPayoutView[] = [];
      for (const id of ids) {
        const view = buildView(id, competence, facts);
        if (view) views.push(view);
      }
      return clone(
        views.sort((a, b) => a.professionalName.localeCompare(b.professionalName, "pt-BR")),
      );
    });
  },

  /** Detalhe do mes com as aulas contadas (inclui substituicoes). */
  getPayoutPreview(professionalId: Id, competence: string): Promise<TeacherPayoutDetail> {
    return readOp(async () => {
      const facts = buildFacts(competence);
      const view = buildView(professionalId, competence, facts);
      if (!view) {
        throw notFoundError(`Este ${teamWords().lower} não tem regra de pagamento vigente neste mês.`);
      }
      const sessions = facts.sessions
        .filter((s) => s.fact.instructorId === professionalId)
        .map(toDetailSession);
      const substitutedSessions = facts.sessions
        .filter(
          (s) =>
            s.fact.primaryInstructorId === professionalId &&
            s.fact.instructorId !== professionalId,
        )
        .map(toDetailSession);
      const upcomingSessions = sessionsIn(competence, "upcoming")
        .filter((s) => s.fact.instructorId === professionalId)
        .map(toDetailSession);
      return clone({ ...view, sessions, substitutedSessions, upcomingSessions });
    });
  },

  /**
   * Salva os ajustes do mes aberto sem fechar (registro `open` so com as linhas
   * de ajuste; o calculo segue ao vivo). Total negativo pode ficar salvo; quem
   * recusa e o fechamento.
   */
  saveAdjustments(
    professionalId: Id,
    competence: string,
    adjustments: TeacherPayoutAdjustment[],
  ): Promise<TeacherPayoutView> {
    return writeOp(async () => {
      if (!isCompetence(competence)) throw notFoundError("Mês inválido.");
      const professional = store.professionals.find((p) => p.id === professionalId);
      if (!professional) throw notFoundError(`${teamWords().title} não encontrado.`);
      const rule = ruleOf(professionalId);
      if (!rule || !isRuleEffective(rule, competence)) {
        throw conflict(`Este ${teamWords().lower} não tem regra de pagamento vigente neste mês.`);
      }
      const existing = payoutOf(professionalId, competence);
      if (existing && existing.status !== "open") {
        throw conflict("Este mês já está fechado. Reabra o mês para mudar os ajustes.");
      }

      const lines = normalizeAdjustments(adjustments);
      // Desconto maior que o mes ja e recusado aqui (antes so travava o fechar).
      const ownFacts = factsFor(professionalId, buildFacts(competence));
      const late = latePaymentShare(professionalId, rule, competence);
      const computed = [...computeTeacherPayout(rule, ownFacts, competence), ...late.lines];
      if ([...computed, ...lines].reduce((sum, l) => sum + l.amountCents, 0) < 0) {
        throw validationError([
          { field: "adjustments", message: "Os descontos deixam o total do mês negativo." },
        ]);
      }
      const before = adjustmentLines(existing);
      const ts = nowIso();
      let payout: TeacherPayout;
      if (existing) {
        Object.assign(existing, {
          lines,
          totalCents: payoutTotalCents(lines),
          dueDate: dueDateOf(rule, competence),
          updatedAt: ts,
        });
        payout = existing;
      } else {
        payout = {
          id: newId(),
          organizationId: store.organization.id,
          professionalId,
          competence,
          lines,
          totalCents: payoutTotalCents(lines),
          dueDate: dueDateOf(rule, competence),
          status: "open",
          createdAt: ts,
          updatedAt: ts,
        };
        store.teacherPayouts.push(payout);
      }

      const describe = (l: TeacherPayoutLine) => `"${l.label}" (${formatSignedCents(l.amountCents)})`;
      const added = lineDifference(lines, before).map(describe);
      const removed = lineDifference(before, lines).map(describe);
      const parts = [
        added.length > 0 ? `adicionou ${pluralWord(added.length, "o ajuste", "os ajustes")} ${added.join(", ")}` : "",
        removed.length > 0 ? `removeu ${pluralWord(removed.length, "o ajuste", "os ajustes")} ${removed.join(", ")}` : "",
      ].filter(Boolean);
      if (parts.length > 0) {
        auditLogService.record({
          action: "updated",
          target: { type: "teacher_payout", id: payout.id, label: payoutLabel(professionalId, competence) },
          predicate: `${parts.join(" e ")} no pagamento de ${professional.name} de ${competenceLabel(competence)}`,
        });
      }
      const view = buildView(professionalId, competence, buildFacts(competence));
      return clone(view!);
    });
  },

  /**
   * Fecha o mes: congela as linhas calculadas + ajustes (bonus positivo,
   * desconto/vale negativo). Total nao pode ficar negativo.
   */
  closePayout(
    professionalId: Id,
    competence: string,
    adjustments?: TeacherPayoutAdjustment[],
  ): Promise<TeacherPayoutView> {
    return writeOp(async () => {
      if (!isCompetence(competence)) throw notFoundError("Mês inválido.");
      if (competence > currentCompetence()) {
        throw conflict("Não é possível fechar um mês que ainda não começou.");
      }
      const professional = store.professionals.find((p) => p.id === professionalId);
      if (!professional) throw notFoundError(`${teamWords().title} não encontrado.`);
      const rule = ruleOf(professionalId);
      if (!rule || !isRuleEffective(rule, competence)) {
        throw conflict(`Este ${teamWords().lower} não tem regra de pagamento vigente neste mês.`);
      }
      const existing = payoutOf(professionalId, competence);
      if (existing && existing.status !== "open") {
        throw conflict("Este mês já está fechado.");
      }

      const ownFacts = factsFor(professionalId, buildFacts(competence));
      const late = latePaymentShare(professionalId, rule, competence);
      const computed = [...computeTeacherPayout(rule, ownFacts, competence), ...late.lines];
      // Sem ajustes na chamada, valem os ja salvos no mes em aberto.
      const adjustmentLinesList = adjustments
        ? normalizeAdjustments(adjustments)
        : adjustmentLines(existing);
      const lines = [...computed, ...adjustmentLinesList];
      const rawTotal = lines.reduce((sum, l) => sum + l.amountCents, 0);
      if (rawTotal < 0) {
        throw validationError([
          { field: "adjustments", message: "Os descontos deixam o total do mês negativo." },
        ]);
      }

      const ts = nowIso();
      const fields = {
        lines,
        totalCents: payoutTotalCents(lines),
        dueDate: dueDateOf(rule, competence),
        status: "closed" as const,
        closedAt: ts,
        paidAt: undefined,
        method: undefined,
        attachments: undefined,
        countedChargeIds: [...percentChargeIds(ownFacts), ...late.chargeIds],
        updatedAt: ts,
      };
      let payout: TeacherPayout;
      if (existing) {
        Object.assign(existing, fields);
        payout = existing;
      } else {
        payout = {
          id: newId(),
          organizationId: store.organization.id,
          professionalId,
          competence,
          ...fields,
          createdAt: ts,
        };
        store.teacherPayouts.push(payout);
      }

      auditLogService.record({
        action: "status_changed",
        target: { type: "teacher_payout", id: payout.id, label: payoutLabel(professionalId, competence) },
        predicate: `fechou o pagamento de ${professional.name} de ${competenceLabel(competence)} (${formatCents(payout.totalCents)})`,
      });
      const view = buildView(professionalId, competence, buildFacts(competence));
      return clone(view!);
    });
  },

  /** Reabre um mes fechado (volta a previa ao vivo; os ajustes ficam como rascunho). */
  reopenPayout(id: Id): Promise<void> {
    return writeOp(async () => {
      const payout = findPayout(id);
      if (payout.status === "paid") {
        throw conflict("Desfaça o pagamento antes de reabrir o mês.");
      }
      if (payout.status !== "closed") throw conflict("Este mês não está fechado.");
      payout.status = "open";
      payout.lines = adjustmentLines(payout);
      payout.totalCents = payoutTotalCents(payout.lines);
      payout.closedAt = undefined;
      payout.updatedAt = nowIso();

      auditLogService.record({
        action: "status_changed",
        target: { type: "teacher_payout", id, label: payoutLabel(payout.professionalId, payout.competence) },
        predicate: `reabriu o pagamento de ${professionalName(payout.professionalId)} de ${competenceLabel(payout.competence)}`,
      });
    });
  },
};
