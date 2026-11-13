import { teacherSeesClassRoster } from "./teacherScope";
import type {
  ClassGroup,
  CreateEnrollment,
  Enrollment,
  EnrollmentView,
  Id,
  MoveStudentsInput,
  MoveStudentsResult,
} from "@gestarahub/contracts";
import { classBillingMode, isCourseEnded, isFutureOpenInstallment } from "@gestarahub/core/billing";
import { plural } from "@gestarahub/core/format";
import { ageAt, currentLevelOf, nextLevelFor, resolveModalityTrack } from "@/lib/progression-tracks";
import { withKind } from "@/lib/text";
import {
  apiError,
  notFoundError,
  nowIso,
  readOp,
  writeOp,
  validationError,
} from "@/services/world/ops";
import { store } from "@/services/world/store";
import { auditLogService } from "../audit/auditLogService";
import { recordPromotion, type PromotionPayload } from "../clients/clientProgressionService";
import { cancelOnlinePaymentsForCharge } from "../onlinePayments";
import { clone, todayISO, studentName, activeEnrollments } from "./classShared";
import { validateStudentScheduleConflict, resolveCourseChoice } from "./classValidation";
import { toEnrollmentView } from "./classViews";
import { assertCanManageProgression } from "./teacherScope";
import { createEnrollment, resolvePaysWithPackage } from "./enrollmentCreation";

export const enrollmentsService = {
  // --- Matriculas ---------------------------------------------------------
  listEnrollments(classGroupId: Id): Promise<EnrollmentView[]> {
    return readOp(async () => {
      const group = store.classGroups.find((g) => g.id === classGroupId);
      // Professor: so a turma dele ou a que substitui (revisao geral de 31/10/2026, achado S4).
      if (group && !teacherSeesClassRoster(group)) {
        throw apiError("FORBIDDEN", "Você só vê as suas turmas.", { httpStatus: 403 });
      }
      const rows = store.enrollments.filter(
        (e) => e.classGroupId === classGroupId && e.status !== "canceled",
      );
      return clone(
        rows
          .map(toEnrollmentView)
          .sort((a, b) => a.studentName.localeCompare(b.studentName, "pt-BR")),
      );
    });
  },

  // Capacidade e regra MOLE: com a turma lotada, lanca CLASS_FULL; o form pede
  // confirmacao e reenvia com `allowOverCapacity`. Curso exige `payload.course`
  // e gera as parcelas na hora (doc 20, fase B).
  enroll(
    payload: CreateEnrollment,
    opts: { allowOverCapacity?: boolean } = {},
  ): Promise<EnrollmentView> {
    return writeOp(async () => {
      const g = store.classGroups.find((x) => x.id === payload.classGroupId);
      if (!g) throw notFoundError("Turma não encontrada.");
      if (g.status !== "active") {
        throw apiError("VALIDATION", "Turma inativada. Reative para matricular.", { httpStatus: 409 });
      }
      const student = store.clients.find((c) => c.id === payload.studentId);
      if (!student) {
        throw validationError([{ field: "studentId", message: "Selecione um aluno." }]);
      }
      const already = store.enrollments.find(
        (e) =>
          e.classGroupId === g.id &&
          e.studentId === payload.studentId &&
          e.status === "active",
      );
      if (already) {
        throw validationError([
          { field: "studentId", message: "Aluno já matriculado nesta turma." },
        ]);
      }
      validateStudentScheduleConflict(payload.studentId, g.id);
      const course = resolveCourseChoice(g, payload.course);
      const withPackage = resolvePaysWithPackage(g, student.id, payload.paysWithPackage);
      if (!opts.allowOverCapacity && activeEnrollments(g.id).length >= g.capacity) {
        throw apiError("CLASS_FULL", `Turma lotada (${g.capacity} vagas).`, {
          httpStatus: 409,
        });
      }
      // Rematricula no curso: as parcelas em aberto das matriculas anteriores
      // saem quando o usuario escolhe (senao seguem como divida).
      let canceledPrevious = 0;
      if (course && payload.cancelOpenCourseCharges) {
        const ts = nowIso();
        for (const c of store.charges) {
          if (c.kind !== "course" || c.studentId !== student.id || c.classGroupId !== g.id) continue;
          if (c.status !== "pending" && c.status !== "overdue") continue;
          c.status = "canceled";
          c.canceledBy = "user";
          c.cancelReason = "Rematrícula no curso";
          c.updatedAt = ts;
          cancelOnlinePaymentsForCharge(c.id);
          canceledPrevious += 1;
        }
      }
      const enrollment = await createEnrollment(g, student.id, course, withPackage);
      if (canceledPrevious > 0) {
        auditLogService.record({
          action: "cancelled",
          target: { type: "enrollment", id: enrollment.id, label: `${student.name} em ${g.name}` },
          predicate: `cancelou ${plural(canceledPrevious, "parcela em aberto", "parcelas em aberto")} da matrícula anterior de ${student.name} no curso ${g.name}`,
        });
      }
      return clone(toEnrollmentView(enrollment));
    });
  },

  /**
   * Troca como o aluno paga a turma de mensalidade: com pacote (cada presenca
   * daqui em diante gasta uma aula) ou pela mensalidade. Aulas ja gastas ficam.
   */
  setEnrollmentPayment(id: Id, paysWithPackage: boolean): Promise<EnrollmentView> {
    return writeOp(async () => {
      const e = store.enrollments.find((x) => x.id === id);
      if (!e || e.status === "canceled") throw notFoundError("Matrícula não encontrada.");
      const g = store.classGroups.find((x) => x.id === e.classGroupId);
      if (!g) throw notFoundError("Turma não encontrada.");
      if (classBillingMode(g) !== "membership") {
        throw apiError("VALIDATION", "Só a turma de mensalidade permite escolher como o aluno paga.", {
          httpStatus: 422,
        });
      }
      if (Boolean(e.paysWithPackage) === paysWithPackage) return clone(toEnrollmentView(e));
      if (paysWithPackage) {
        resolvePaysWithPackage(g, e.studentId, true);
        e.paysWithPackage = true;
      } else {
        delete e.paysWithPackage;
      }

      const name = studentName(e.studentId);
      auditLogService.record({
        action: "updated",
        target: { type: "enrollment", id: e.id, label: `${name} em ${g.name}` },
        predicate: paysWithPackage
          ? `passou ${name} a pagar a turma ${g.name} com pacote`
          : `passou ${name} a pagar a turma ${g.name} com mensalidade`,
      });
      return clone(toEnrollmentView(e));
    });
  },

  cancelEnrollment(id: Id, reason?: string): Promise<void> {
    return writeOp(async () => {
      const e = store.enrollments.find((x) => x.id === id);
      if (!e) throw notFoundError("Matrícula não encontrada.");
      if (e.status === "canceled") {
        throw apiError("VALIDATION", "Esta matrícula já foi cancelada.", { httpStatus: 409 });
      }
      e.status = "canceled";
      e.canceledAt = nowIso();
      e.cancellationReason = reason?.trim() || undefined;

      const g = store.classGroups.find((x) => x.id === e.classGroupId);
      const turma = g?.name ?? "";
      // Curso (decisao 1 do doc 20): pagas ficam, as futuras saem e as que ja
      // venceram seguem como divida. Curso ja concluido nao cancela nada (foi dado).
      let canceledInstallments = 0;
      if (e.course && !(g && isCourseEnded(g, todayISO()))) {
        const today = todayISO();
        const ts = nowIso();
        for (const c of store.charges) {
          if (c.kind !== "course" || c.enrollmentId !== e.id || !isFutureOpenInstallment(c, today)) continue;
          c.status = "canceled";
          c.canceledBy = "system";
          c.cancelReason = "Matrícula cancelada";
          c.updatedAt = ts;
          cancelOnlinePaymentsForCharge(c.id);
          canceledInstallments += 1;
        }
      }
      auditLogService.record({
        action: "cancelled",
        target: { type: "enrollment", id, label: `${studentName(e.studentId)} em ${turma}` },
        predicate: e.course
          ? `cancelou a matrícula de ${studentName(e.studentId)} no ${withKind("curso", turma)}${canceledInstallments > 0 ? ` e ${plural(canceledInstallments, "parcela futura", "parcelas futuras")}` : ""}`
          : `cancelou a matrícula de ${studentName(e.studentId)} na turma ${turma}`,
      });
    });
  },

  /**
   * Mudar de turma (doc product/30 §2): fecha a matricula na turma de origem
   * como "Mudou para {turma}" (encerrada, mas nao e saida do aluno) e abre a
   * nova na mesma hora, para um ou varios alunos. Tudo ou nada: confere todos
   * antes de gravar. Lotacao e regra mole (CLASS_FULL; a tela confirma e
   * reenvia). Curso fica de fora: o proximo modulo e uma matricula nova, com
   * cobranca. Com `promote`, cada aluno sobe para o proximo nivel da trilha.
   */
  moveStudents(
    input: MoveStudentsInput,
    opts: { allowOverCapacity?: boolean } = {},
  ): Promise<MoveStudentsResult> {
    return writeOp(async () => {
      const from = store.classGroups.find((g) => g.id === input.fromClassGroupId);
      if (!from) throw notFoundError("Turma não encontrada.");
      const to = store.classGroups.find((g) => g.id === input.toClassGroupId);
      const field = "toClassGroupId";
      if (!to) throw validationError([{ field, message: "Escolha a turma de destino." }]);
      if (to.id === from.id) throw validationError([{ field, message: "Escolha outra turma." }]);
      if (to.status !== "active") throw validationError([{ field, message: "Esta turma está inativada." }]);
      if (classBillingMode(from) === "course" || classBillingMode(to) === "course") {
        throw validationError([{ field, message: "Curso não muda de turma: matricule no próximo curso." }]);
      }

      const studentIds = [...new Set(input.studentIds)];
      if (studentIds.length === 0) {
        throw validationError([{ field: "studentIds", message: "Escolha ao menos um aluno." }]);
      }
      const moving: Enrollment[] = studentIds.map((studentId) => {
        const found = store.enrollments.find(
          (e) => e.classGroupId === from.id && e.studentId === studentId && e.status === "active",
        );
        if (!found) {
          throw validationError([{ field: "studentIds", message: `${studentName(studentId)} não está ativo nesta turma.` }]);
        }
        return found;
      });
      const inDestination = new Set(activeEnrollments(to.id).map((e) => e.studentId));
      const already = moving.filter((e) => inDestination.has(e.studentId)).map((e) => studentName(e.studentId));
      if (already.length > 0) {
        throw validationError([
          { field: "studentIds", message: `${already.join(", ")} já ${already.length === 1 ? "está" : "estão"} em ${to.name}.` },
        ]);
      }
      for (const e of moving) validateStudentScheduleConflict(e.studentId, to.id, from.id);
      // Quem paga com pacote segue assim (precisa de pacote que valha na turma nova).
      const withPackage = new Map(moving.map((e) => [e.id, resolvePaysWithPackage(to, e.studentId, e.paysWithPackage)]));
      const free = to.capacity - inDestination.size;
      if (!opts.allowOverCapacity && moving.length > free) {
        throw apiError(
          "CLASS_FULL",
          free <= 0
            ? `Turma lotada (${to.capacity} vagas).`
            : `${to.name} tem ${plural(free, "vaga livre", "vagas livres")} para ${plural(moving.length, "aluno", "alunos")}.`,
          { httpStatus: 409 },
        );
      }
      const promotions = input.promote ? promotionsFor(to, studentIds) : new Map<Id, PromotionPayload>();

      const ts = nowIso();
      let promoted = 0;
      for (const e of moving) {
        e.status = "canceled";
        e.canceledAt = ts;
        e.cancellationReason = `Mudou para ${to.name}`;
        e.movedToClassGroupId = to.id;
        const created = await createEnrollment(to, e.studentId, undefined, withPackage.get(e.id), { skipAudit: true });
        const name = studentName(e.studentId);
        auditLogService.record({
          action: "updated",
          target: { type: "enrollment", id: created.id, label: `${name} em ${to.name}` },
          predicate: `mudou ${name} da turma ${from.name} para ${to.name}`,
        });
        const promotion = promotions.get(e.studentId);
        if (promotion) {
          recordPromotion(promotion);
          promoted += 1;
        }
      }
      return { moved: moving.length, promoted };
    });
  },

  /** Pares aluno x modalidade das matriculas ativas (uma linha por par). */
  listEnrolledModalities(): Promise<{ studentId: Id; modalityId: Id }[]> {
    return readOp(() => {
      const modalityByGroup = new Map(store.classGroups.map((g) => [g.id, g.modalityId]));
      const seen = new Set<string>();
      const pairs: { studentId: Id; modalityId: Id }[] = [];
      for (const e of store.enrollments) {
        if (e.status !== "active") continue;
        const modalityId = modalityByGroup.get(e.classGroupId);
        if (!modalityId || seen.has(`${e.studentId}~${modalityId}`)) continue;
        seen.add(`${e.studentId}~${modalityId}`);
        pairs.push({ studentId: e.studentId, modalityId });
      }
      return pairs;
    });
  },
};

/**
 * "Subir de nivel junto" (doc product/30 §2): o proximo nivel inteiro de cada
 * aluno na trilha da modalidade da turma de destino, na data de hoje. Quem ja
 * esta no ultimo nivel fica como esta. Pede quem pode graduar o aluno.
 */
function promotionsFor(to: ClassGroup, studentIds: Id[]): Map<Id, PromotionPayload> {
  const modality = store.categories.find((c) => c.id === to.modalityId);
  const track = modality ? resolveModalityTrack(modality) : undefined;
  if (!modality || !track?.enabled) {
    throw validationError([{ field: "promote", message: "A modalidade desta turma não tem trilha de níveis." }]);
  }
  const today = todayISO();
  const out = new Map<Id, PromotionPayload>();
  for (const studentId of studentIds) {
    assertCanManageProgression(studentId, { modalityId: modality.id });
    const student = store.clients.find((c) => c.id === studentId);
    if (!student) continue;
    const age = ageAt(student.birthDate, today);
    const progression = student.progressions?.[modality.id];
    const next = nextLevelFor(track, currentLevelOf(track, progression, age), age);
    if (!next) continue;
    out.set(studentId, {
      studentId,
      modalityId: modality.id,
      modalityName: modality.name,
      toLevelId: next.id,
      toLevelName: next.name,
      toLevelColor: next.color,
      toSubLevel: 0,
      maxSubLevels: next.maxSubLevels,
      date: today,
      notes: `Mudou para a turma ${to.name}`,
    });
  }
  return out;
}
