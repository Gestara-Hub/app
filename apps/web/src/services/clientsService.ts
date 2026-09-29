import type {
  ApiErrorField,
  Category,
  Charge,
  Client,
  ClientFilter,
  CreateClient,
  CreateClientInitialCharge,
  DateISO,
  EvaluationEntryTone,
  Id,
  ProgressionBeltColor,
  StudentModalityOverviewItem,
  StudentModalityProgression,
  StudentProgressionOverview,
  UpdateClient,
} from "@gestarahub/contracts";
import { chargesDueIn } from "@gestarahub/core/billing";
import { plural } from "@gestarahub/core/format";
import { format } from "date-fns";
import { resolveModalityTrack } from "@/lib/progression-tracks";
import { store } from "@/mocks/store";
import {
  newId,
  notFoundError,
  nowIso,
  simulateRead,
  simulateWrite,
  phoneIncludes,
  textIncludes,
  validationError,
} from "@/mocks/helpers";
import { auditLogService } from "./auditLogService";
import {
  cancelOpenMembershipCharges,
  chargeStartedMembershipPeriods,
  studentMembershipTerms,
} from "./billingService";
import { clientNoun } from "./nouns";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const NOT_FOUND = "Cliente não encontrado.";

function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/**
 * 1a mensalidade do aluno no plano. Valor e vencimento vem do formulario (que
 * usa o motor de cobranca e permite ajuste); o periodo de referencia garante
 * que a geracao em lote reconheca esta cobranca e nao a duplique.
 */
function initialMembershipCharge(client: Client, input: CreateClientInitialCharge): Charge {
  const ts = nowIso();
  const competence = input.dueDate.slice(0, 7);
  const plan = store.plans.find((p) => p.id === client.planId);
  const slot = plan
    ? chargesDueIn(studentMembershipTerms(client, plan), competence).find(
        (c) => c.periodStart === input.periodStart,
      )
    : undefined;
  return {
    id: newId(),
    organizationId: store.organization.id,
    unitId: store.unit.id,
    studentId: client.id,
    kind: "membership",
    planId: client.planId,
    competence,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    dueDate: input.dueDate,
    amountCents: input.amountCents,
    status: "pending",
    cycleIndex: slot?.cycleIndex ?? 1,
    cycleTotal: slot?.cycleTotal ?? 1,
    isProrated: input.isProrated,
    proratedDays: input.proratedDays,
    notes: input.isProrated
      ? `Mensalidade proporcional (${input.proratedDays ?? 0} dias)`
      : "1ª mensalidade",
    createdAt: ts,
    updatedAt: ts,
  };
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// NOTA: mensagens a confirmar com o doc 10 quando o modulo Clientes for feito.
function validateClient(
  payload: Partial<CreateClient>,
  { partial }: { partial: boolean },
): void {
  const fields: ApiErrorField[] = [];
  const has = (key: keyof CreateClient) =>
    Object.prototype.hasOwnProperty.call(payload, key);

  if (!partial || has("name")) {
    if (!payload.name || !payload.name.trim()) {
      fields.push({ field: "name", message: `Informe o nome do ${clientNoun()}.` });
    }
  }
  if (!partial || has("phone")) {
    if (!payload.phone || !payload.phone.trim()) {
      fields.push({ field: "phone", message: "Informe o telefone." });
    }
  }
  if (has("email") && payload.email && !EMAIL_RE.test(payload.email)) {
    fields.push({ field: "email", message: "Informe um e-mail válido." });
  }

  if (fields.length > 0) throw validationError(fields);
}

export const clientsService = {
  list(filter?: ClientFilter): Promise<Client[]> {
    return simulateRead(() => {
      let result = store.clients;
      if (filter?.search) {
        const term = filter.search;
        result = result.filter(
          (c) => textIncludes(c.name, term) || phoneIncludes(c.phone, term),
        );
      }
      if (filter?.status) {
        result = result.filter((c) => c.status === filter.status);
      }
      return clone(
        [...result].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      );
    });
  },

  getById(id: Id): Promise<Client> {
    return simulateRead(() => {
      const found = store.clients.find((c) => c.id === id);
      if (!found) throw notFoundError(NOT_FOUND);
      return clone(found);
    });
  },

  create(payload: CreateClient): Promise<Client> {
    return simulateWrite(() => {
      validateClient(payload, { partial: false });
      const ts = nowIso();
      const client: Client = {
        id: newId(),
        organizationId: store.organization.id,
        name: payload.name.trim(),
        phone: payload.phone.trim(),
        email: payload.email?.trim() || undefined,
        notes: payload.notes?.trim() || undefined,
        address: payload.address,
        planId: payload.planId || undefined,
        planStartDate: payload.planStartDate || undefined,
        billingStrategy: payload.billingStrategy || undefined,
        cyclePaymentTiming: payload.cyclePaymentTiming || undefined,
        dueDay: payload.dueDay || store.organization.settings?.defaultDueDay || 10,
        discount: payload.discount,
        membershipStatus: payload.membershipStatus ?? "active",
        status: payload.status ?? "active",
        createdAt: ts,
        updatedAt: ts,
      };
      store.clients.push(client);

      // 1a mensalidade (calculada no cadastro pelo motor de cobranca e ajustavel).
      if (client.planId && payload.initialCharge && payload.initialCharge.amountCents > 0) {
        store.charges.push(initialMembershipCharge(client, payload.initialCharge));
      }

      auditLogService.record({
        action: "created",
        target: { type: "client", id: client.id, label: client.name },
        predicate: `criou o ${clientNoun()} ${client.name}`,
      });
      return clone(client);
    });
  },

  update(id: Id, payload: UpdateClient): Promise<Client> {
    return simulateWrite(() => {
      const idx = store.clients.findIndex((c) => c.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      validateClient(payload, { partial: true });
      const current = store.clients[idx];
      const ts = nowIso();
      const updated: Client = {
        ...current,
        ...payload,
        updatedAt: ts,
      };
      store.clients[idx] = updated;

      // Troca de plano ou de data de inicio: as mensalidades em aberto do
      // arranjo anterior a partir da nova vigencia deixam de valer.
      const planChanged =
        Boolean(updated.planId) &&
        (current.planId !== updated.planId || current.planStartDate !== updated.planStartDate);
      if (planChanged && current.planId && updated.planStartDate) {
        cancelOpenMembershipCharges(updated.id, updated.planStartDate, "Cancelada por troca de plano", {
          inclusive: true,
        });
      }
      // Troca da regra (momento do pagamento, entrada no meio do periodo ou dia
      // de vencimento) muda os periodos/vencimentos: as mensalidades em aberto de
      // periodos que ainda nao comecaram saem, e a geracao recria pela regra nova
      // (sem cobrar de novo o que ja foi cobrado).
      // Compara os termos efetivos (regra do aluno ou da academia), para nao
      // cancelar nada quando so muda a forma de guardar a mesma regra.
      const rulePlan = store.plans.find((p) => p.id === updated.planId);
      const beforeTerms = rulePlan ? studentMembershipTerms(current, rulePlan) : undefined;
      const afterTerms = rulePlan ? studentMembershipTerms(updated, rulePlan) : undefined;
      const rulesChanged =
        beforeTerms !== undefined &&
        afterTerms !== undefined &&
        (beforeTerms.strategy !== afterTerms.strategy ||
          beforeTerms.timing !== afterTerms.timing ||
          beforeTerms.dueDay !== afterTerms.dueDay);
      if (!planChanged && rulesChanged && current.planId === updated.planId) {
        cancelOpenMembershipCharges(updated.id, todayISO(), "Cancelada por troca da regra de cobrança");
      }
      if (updated.planId && payload.initialCharge && payload.initialCharge.amountCents > 0) {
        const charge = initialMembershipCharge(updated, payload.initialCharge);
        const exists = store.charges.some(
          (c) =>
            c.kind === "membership" &&
            c.studentId === updated.id &&
            c.planId === updated.planId &&
            c.status !== "canceled" &&
            (c.periodStart ? c.periodStart === charge.periodStart : c.competence === charge.competence),
        );
        if (!exists) store.charges.push(charge);
      }

      auditLogService.record({
        action: current.status !== "active" && updated.status === "active" ? "activated" : "updated",
        target: { type: "client", id: updated.id, label: updated.name },
        predicate: `${current.status !== "active" && updated.status === "active" ? "reativou" : "atualizou"} o ${clientNoun()} ${updated.name}`,
      });
      return clone(updated);
    });
  },

  // remove = inativacao logica; cliente permanece no historico.
  remove(id: Id): Promise<void> {
    return simulateWrite(() => {
      const idx = store.clients.findIndex((c) => c.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      const before = store.clients[idx];
      const name = before.name;
      // "Depois do uso": o periodo em uso (ou ja usado e ainda nao gerado) vira
      // cobranca agora, senao se perderia com a geracao pulando inativos.
      const plan = before.planId ? store.plans.find((p) => p.id === before.planId) : undefined;
      const charged =
        before.status === "active" && plan && studentMembershipTerms(before, plan).timing === "postpaid"
          ? chargeStartedMembershipPeriods(before, todayISO())
          : 0;
      store.clients[idx] = {
        ...before,
        status: "inactive",
        updatedAt: nowIso(),
      };
      // Mensalidades de periodos que ainda nao comecaram deixam de valer; o que
      // ja foi usado continua em aberto como divida.
      const canceled = cancelOpenMembershipCharges(id, todayISO(), "Cancelada na inativação do aluno");
      auditLogService.record({
        action: "inactivated",
        target: { type: "client", id, label: name },
        predicate: `inativou o ${clientNoun()} ${name}${charged > 0 ? `, gerou ${plural(charged, "mensalidade do período usado", "mensalidades dos períodos usados")}` : ""}${canceled > 0 ? ` e cancelou ${plural(canceled, "mensalidade futura", "mensalidades futuras")}` : ""}`,
      });
    });
  },

  getProgressionOverview(studentId: Id): Promise<StudentProgressionOverview> {
    return simulateRead(() => {
      const client = store.clients.find((c) => c.id === studentId);
      if (!client) throw notFoundError(NOT_FOUND);

      const activeEnrollments = store.enrollments.filter(
        (e) => e.studentId === studentId && e.status === "active",
      );
      const enrolledGroupIds = new Set(activeEnrollments.map((e) => e.classGroupId));
      const enrolledGroups = store.classGroups.filter((g) => enrolledGroupIds.has(g.id));

      const categoriesById = new Map<Id, Category>();
      for (const cat of store.categories) {
        if (cat.status === "active") {
          categoriesById.set(cat.id, {
            ...cat,
            progressionTrack: resolveModalityTrack(cat),
          });
        }
      }

      // Garante que modalidades em que o aluno ja tem progresso tambem aparecam
      const existingProgressions = client.progressions ?? {};
      for (const modId of Object.keys(existingProgressions)) {
        if (!categoriesById.has(modId)) {
          const found = store.categories.find((c) => c.id === modId);
          if (found) {
            categoriesById.set(found.id, {
              ...found,
              progressionTrack: resolveModalityTrack(found),
            });
          }
        }
      }

      const items: StudentModalityOverviewItem[] = [];
      for (const modality of categoriesById.values()) {
        const groupsInModality = store.classGroups.filter(
          (g) => g.modalityId === modality.id,
        );
        const groupIdsInModality = new Set(groupsInModality.map((g) => g.id));
        const studentGroupsInModality = enrolledGroups.filter(
          (g) => g.modalityId === modality.id,
        );
        const isEnrolled = studentGroupsInModality.length > 0;
        const progression = existingProgressions[modality.id];
        const promotedAt = progression?.promotedAt;

        let totalPresentInModality = 0;
        let presentSincePromotion = 0;

        for (const att of store.attendances) {
          if (att.studentId !== studentId || att.status !== "present") continue;
          const [groupId, sessionDate] = att.sessionId.split("~");
          if (!groupIdsInModality.has(groupId)) continue;
          totalPresentInModality += 1;
          if (!promotedAt || (sessionDate && sessionDate >= promotedAt)) {
            presentSincePromotion += 1;
          }
        }

        items.push({
          modality,
          isEnrolled,
          enrolledClassNames: studentGroupsInModality.map((g) => g.name),
          presentSincePromotion:
            presentSincePromotion + (progression?.initialAttendanceOffset ?? 0),
          totalPresentInModality:
            totalPresentInModality + (progression?.initialAttendanceOffset ?? 0),
          progression,
        });
      }

      // Ordena primeiro modalidades em que o aluno esta matriculado ou ja possui progresso
      items.sort((a, b) => {
        const aScore = (a.isEnrolled ? 2 : 0) + (a.progression ? 1 : 0);
        const bScore = (b.isEnrolled ? 2 : 0) + (b.progression ? 1 : 0);
        if (aScore !== bScore) return bScore - aScore;
        return a.modality.position - b.modality.position;
      });

      return clone({
        studentId: client.id,
        studentName: client.name,
        items,
      });
    });
  },

  saveModalityProgression(
    studentId: Id,
    progression: Omit<StudentModalityProgression, "updatedAt">,
  ): Promise<Client> {
    return simulateWrite(() => {
      const idx = store.clients.findIndex((c) => c.id === studentId);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      const current = store.clients[idx];
      const ts = nowIso();
      const nextEntry: StudentModalityProgression = {
        ...progression,
        updatedAt: ts,
      };
      const updated: Client = {
        ...current,
        progressions: {
          ...(current.progressions ?? {}),
          [progression.modalityId]: nextEntry,
        },
        updatedAt: ts,
      };
      store.clients[idx] = updated;
      auditLogService.record({
        action: "updated",
        target: { type: "client", id: updated.id, label: updated.name },
        predicate: `atualizou o progresso de ${updated.name} (${progression.levelName})`,
      });
      return clone(updated);
    });
  },

  promoteStudent(payload: {
    studentId: Id;
    modalityId: Id;
    modalityName?: string;
    toLevelId?: string;
    toLevelName: string;
    toLevelColor: ProgressionBeltColor;
    toSubLevel: number;
    maxSubLevels?: number;
    date: DateISO;
    attendancesCompleted?: number;
    monthsInLevel?: number;
    isExam?: boolean;
    notes?: string;
  }): Promise<Client> {
    return simulateWrite(() => {
      const idx = store.clients.findIndex((c) => c.id === payload.studentId);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      const current = store.clients[idx];
      const ts = nowIso();
      const prev = current.progressions?.[payload.modalityId];

      const historyEntry = {
        id: newId(),
        date: payload.date,
        fromLevelName: prev?.levelName,
        fromSubLevel: prev?.subLevel,
        toLevelName: payload.toLevelName,
        toLevelColor: payload.toLevelColor,
        toSubLevel: payload.toSubLevel,
        attendancesCompleted: payload.attendancesCompleted,
        monthsInLevel: payload.monthsInLevel,
        isExam: payload.isExam,
        notes: payload.notes?.trim() || undefined,
        createdAt: ts,
      };

      const nextProgression: StudentModalityProgression = {
        modalityId: payload.modalityId,
        modalityName: payload.modalityName ?? prev?.modalityName,
        levelId: payload.toLevelId,
        levelName: payload.toLevelName,
        levelColor: payload.toLevelColor,
        subLevel: payload.toSubLevel,
        maxSubLevels: payload.maxSubLevels ?? prev?.maxSubLevels ?? 4,
        promotedAt: payload.date,
        initialAttendanceOffset: 0,
        nextExamDate: undefined,
        strengths: prev?.strengths ?? [],
        focusAreas: prev?.focusAreas ?? [],
        evaluations: prev?.evaluations ?? [],
        promotionHistory: [historyEntry, ...(prev?.promotionHistory ?? [])],
        updatedAt: ts,
      };

      const updated: Client = {
        ...current,
        progressions: {
          ...(current.progressions ?? {}),
          [payload.modalityId]: nextProgression,
        },
        updatedAt: ts,
      };
      store.clients[idx] = updated;
      auditLogService.record({
        action: "updated",
        target: { type: "client", id: updated.id, label: updated.name },
        predicate: `graduou ${updated.name} para ${payload.toLevelName}${payload.toSubLevel > 0 ? ` (${payload.toSubLevel}º grau)` : ""}`,
      });
      return clone(updated);
    });
  },

  addSessionEvaluation(payload: {
    studentId: Id;
    modalityId: Id;
    modalityName?: string;
    classGroupId?: Id;
    classGroupName?: string;
    sessionId?: Id;
    date: DateISO;
    tone: EvaluationEntryTone;
    note: string;
    authorName?: string;
  }): Promise<Client> {
    return simulateWrite(() => {
      const idx = store.clients.findIndex((c) => c.id === payload.studentId);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      const current = store.clients[idx];
      const ts = nowIso();
      const modality = store.categories.find((c) => c.id === payload.modalityId);
      const track = resolveModalityTrack(modality);
      const firstLevel = track.levels[0] ?? {
        id: "lvl-default",
        name: "Iniciante",
        color: "white" as const,
        maxSubLevels: 4,
      };
      const prev = current.progressions?.[payload.modalityId];

      const evaluation = {
        id: newId(),
        date: payload.date,
        classGroupId: payload.classGroupId,
        classGroupName: payload.classGroupName,
        sessionId: payload.sessionId,
        tone: payload.tone,
        note: payload.note.trim(),
        authorName: payload.authorName,
        createdAt: ts,
      };

      const nextProgression: StudentModalityProgression = prev
        ? {
            ...prev,
            evaluations: [evaluation, ...prev.evaluations],
            updatedAt: ts,
          }
        : {
            modalityId: payload.modalityId,
            modalityName: payload.modalityName ?? modality?.name,
            levelId: firstLevel.id,
            levelName: firstLevel.name,
            levelColor: firstLevel.color,
            subLevel: 0,
            maxSubLevels: firstLevel.maxSubLevels,
            promotedAt: payload.date,
            strengths: [],
            focusAreas: [],
            evaluations: [evaluation],
            promotionHistory: [],
            updatedAt: ts,
          };

      const updated: Client = {
        ...current,
        progressions: {
          ...(current.progressions ?? {}),
          [payload.modalityId]: nextProgression,
        },
        updatedAt: ts,
      };
      store.clients[idx] = updated;
      return clone(updated);
    });
  },
};
