import type {
  ApiErrorField,
  Category,
  Charge,
  Client,
  ClientFilter,
  CreateClassRecordsBatch,
  CreateClient,
  CreateClientInitialCharge,
  CreateStudentClassRecord,
  DateISO,
  Id,
  PaginatedResult,
  ProgressionBeltColor,
  ProgressionTermSuggestions,
  StudentEvaluationEntry,
  StudentGoal,
  StudentGoalProgressEntry,
  StudentModalityOverviewItem,
  StudentModalityProgression,
  StudentProgressionOverview,
  UpdateClient,
} from "@gestarahub/contracts";
import { paginateArray } from "@gestarahub/contracts";
import { chargesDueIn, isCourseEnded, isFutureOpenInstallment } from "@gestarahub/core/billing";
import { formatCents, plural } from "@gestarahub/core/format";
import { format, parseISO } from "date-fns";
import { firstLevelForAge, resolveModalityTrack } from "@/lib/progression-tracks";
import { getCurrentActor } from "@/mocks/currentActor";
import { store } from "@/mocks/store";
import {
  newId,
  normalizeText,
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
  isPlanlessScholar,
  membershipPeriodTaken,
  planlessScholarCharges,
  scholarshipChargeFields,
  studentMembershipTerms,
} from "./billingService";
import { isSupabaseOrganization } from "@/lib/session";
import { clientNoun } from "./nouns";
import {
  cancelOnlinePaymentsForCharge,
} from "./onlinePaymentsService";
import { assertCanManageProgression } from "./teacherScope";
import {
  createClientInDb,
  getClientFromDb,
  inactivateClientInDb,
  listClientsFromDb,
  listClientsPaginatedFromDb,
  promoteStudentInDb,
  saveModalityProgressionInDb,
  updateClientInDb,
  updateStudentProgressionInDb,
} from "./clientsBackend";
import { insertChargesInDb } from "./billingBackend";

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
    ...scholarshipChargeFields(client, {
      amountCents: input.amountCents,
      discountApplied: slot?.discountApplied ?? Boolean(client.discount),
      listAmountCents: slot?.listAmountCents ?? input.amountCents,
    }),
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
/** Isentas do bolsista integral sem plano: mes de inicio e mes atual. */
function ensurePlanlessScholarCharges(client: Client): void {
  if (!isPlanlessScholar(client)) return;
  const start = (client.planStartDate || todayISO()).slice(0, 7);
  const current = todayISO().slice(0, 7);
  for (const competence of new Set([start, current])) {
    planlessScholarCharges(client, competence);
  }
}

// --- Sugestoes da evolucao (aprendidas do uso) ----------------------------

type ProgressionTermKind = "strengths" | "goals";

/** Ate quantos termos a sugestao devolve (a tela mostra 6; a busca ao digitar usa todos). */
const MAX_TERM_SUGGESTIONS = 40;

/**
 * Termos ja usados (pontos fortes ou focos) NA modalidade, do mais usado ao
 * menos. So a propria modalidade: termos de Jiu-Jitsu nao sugerem no Muay Thai.
 * Cada aluno conta uma vez por termo; maiusculas e acentos nao diferenciam, e
 * a grafia exibida e a mais usada.
 */
function progressionTermSuggestions(kind: ProgressionTermKind, modalityId: Id): string[] {
  const byKey = new Map<string, { students: Set<Id>; spellings: Map<string, number> }>();
  for (const client of store.clients) {
    const progression = client.progressions?.[modalityId];
    if (!progression) continue;
    const terms = kind === "strengths" ? progression.strengths ?? [] : (progression.goals ?? []).map((g) => g.title);
    for (const raw of terms) {
      const term = raw.trim();
      const key = normalizeText(term);
      if (!key) continue;
      const entry = byKey.get(key) ?? { students: new Set<Id>(), spellings: new Map<string, number>() };
      entry.students.add(client.id);
      entry.spellings.set(term, (entry.spellings.get(term) ?? 0) + 1);
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()]
    .map((entry) => ({
      count: entry.students.size,
      label: [...entry.spellings].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))[0][0],
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"))
    .slice(0, MAX_TERM_SUGGESTIONS)
    .map((term) => term.label);
}

// --- Progresso por modalidade (graduacao, metas, registros) -----------------

/** Progresso do aluno na modalidade; sem registro ainda, comeca no 1o nivel. */
function progressionOf(client: Client, modalityId: Id, date: DateISO): StudentModalityProgression {
  const prev = client.progressions?.[modalityId];
  if (prev) {
    return {
      ...prev,
      strengths: [...(prev.strengths ?? [])],
      goals: (prev.goals ?? []).map((g) => ({ ...g })),
      evaluations: [...(prev.evaluations ?? [])],
    };
  }
  const modality = store.categories.find((c) => c.id === modalityId);
  // Comeca no 1o nivel da idade, como o "Comecou aqui" do ponto de partida.
  const firstLevel = firstLevelForAge(resolveModalityTrack(modality), client.birthDate, date) ?? {
    id: "lvl-default",
    name: "Iniciante",
    color: "white" as const,
    maxSubLevels: 4,
  };
  // "Desde": quando entrou na modalidade (1a matricula numa turma dela), nao a
  // data do registro, que nao e graduacao.
  const groupIds = new Set(store.classGroups.filter((g) => g.modalityId === modalityId).map((g) => g.id));
  const since =
    store.enrollments
      .filter((e) => e.studentId === client.id && groupIds.has(e.classGroupId))
      .map((e) => format(parseISO(e.enrolledAt), "yyyy-MM-dd"))
      .sort()[0] ?? (client.createdAt ? format(parseISO(client.createdAt), "yyyy-MM-dd") : date);
  return {
    modalityId,
    modalityName: modality?.name,
    levelId: firstLevel.id,
    levelName: firstLevel.name,
    levelColor: firstLevel.color,
    subLevel: 0,
    maxSubLevels: firstLevel.maxSubLevels,
    promotedAt: since < date ? since : date,
    strengths: [],
    goals: [],
    evaluations: [],
    promotionHistory: [],
    updatedAt: nowIso(),
  };
}

/** Grava o progresso da modalidade no aluno (substitui o registro do indice). */
async function writeProgression(idx: number, progression: StudentModalityProgression): Promise<Client> {
  const current = store.clients[idx];
  const ts = nowIso();
  const nextProgression = { ...progression, updatedAt: ts };
  const updated: Client = {
    ...current,
    progressions: {
      ...(current.progressions ?? {}),
      [progression.modalityId]: nextProgression,
    },
    updatedAt: ts,
  };
  store.clients[idx] = updated;

  if (isSupabaseOrganization(store.organization.id)) {
    try {
      await updateStudentProgressionInDb(store.organization.id, current.id, nextProgression);
    } catch (err) {
      console.error("[clientsService] Erro ao sincronizar progressão no Supabase:", err);
    }
  }

  return updated;
}

async function ensureClientInStore(id: Id): Promise<number> {
  let idx = store.clients.findIndex((c) => c.id === id);
  if (idx === -1 && isSupabaseOrganization(store.organization.id)) {
    const dbClient = await getClientFromDb(store.organization.id, id);
    if (dbClient) {
      store.clients.push(dbClient);
      idx = store.clients.length - 1;
    }
  }
  if (idx === -1) throw notFoundError(NOT_FOUND);
  return idx;
}

function findGoal(progression: StudentModalityProgression, goalId: Id): StudentGoal {
  const goal = progression.goals.find((g) => g.id === goalId);
  if (!goal) throw notFoundError("Meta não encontrada.");
  return goal;
}

/**
 * Soma o avanco das metas no registro (com alvo: +amount, feita ao chegar no
 * alvo; sem alvo: `completed` marca como feita). Devolve o resumo para o registro.
 */
function applyGoalProgress(
  progression: StudentModalityProgression,
  items: CreateStudentClassRecord["goalProgress"],
  date: DateISO,
): StudentGoalProgressEntry[] {
  const entries: StudentGoalProgressEntry[] = [];
  for (const item of items ?? []) {
    const goal = progression.goals.find((g) => g.id === item.goalId);
    if (!goal || goal.completedAt) continue;
    if (goal.target) {
      const amount = Math.max(0, Math.round(item.amount ?? 0));
      if (amount === 0) continue;
      goal.progress = Math.min(goal.target, goal.progress + amount);
      const completed = goal.progress >= goal.target;
      if (completed) goal.completedAt = date;
      entries.push({ goalId: goal.id, title: goal.title, amount, ...(completed ? { completed } : {}) });
    } else if (item.completed) {
      goal.completedAt = date;
      entries.push({ goalId: goal.id, title: goal.title, completed: true });
    }
  }
  return entries;
}

function newClassRecord(
  input: Omit<StudentEvaluationEntry, "id" | "createdAt" | "authorName">,
): StudentEvaluationEntry {
  const author = getCurrentActor()?.name;
  return {
    id: newId(),
    ...input,
    ...(author ? { authorName: author } : {}),
    createdAt: nowIso(),
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// NOTA: mensagens a confirmar com o doc 10 quando o modulo Clientes for feito.
function validateClient(
  payload: Partial<CreateClient>,
  { partial, current }: { partial: boolean; current?: Client },
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
  if (has("birthDate") && payload.birthDate && payload.birthDate > todayISO()) {
    fields.push({ field: "birthDate", message: "A data de nascimento não pode ser futura." });
  }
  payload.guardians?.forEach((g, i) => {
    if (!g.name?.trim()) {
      fields.push({ field: `guardians.${i}.name`, message: "Informe o nome do responsável." });
    }
  });
  // So a bolsa integral dispensa plano; a parcial cobra uma parte dele. Na
  // edicao, o que nao veio no payload vale o que ja esta gravado.
  const d = has("discount") ? payload.discount : current?.discount;
  const planId = has("planId") ? payload.planId : current?.planId;
  if (d?.scholarship && !planId && !(d.type === "percentage" && d.value >= 100)) {
    fields.push({ field: "planId", message: "Bolsa parcial precisa de um plano." });
  }
  // Desconto nunca passa do plano (o valor todo vira isento, nunca negativo).
  if (d && !d.scholarship) {
    const plan = planId ? store.plans.find((p) => p.id === planId) : undefined;
    if (d.value < 0 || (d.type === "percentage" && d.value > 100)) {
      fields.push({ field: "discountValue", message: "Informe um desconto entre 0% e 100%." });
    } else if (d.type === "fixed" && plan && d.value > plan.priceCents) {
      fields.push({
        field: "discountValue",
        message: `O desconto passa do valor do plano (${formatCents(plan.priceCents)}).`,
      });
    }
  }

  if (fields.length > 0) throw validationError(fields);
}

/** Registro de aula so no dia da aula ou depois. */
function assertRecordDate(date: DateISO): void {
  if (date > todayISO()) {
    throw validationError([{ field: "date", message: "Registre a aula no dia dela ou depois." }]);
  }
}

/**
 * Inativar encerra as matriculas (decisao de 18/10/2026): a vaga libera e o
 * aluno sai das chamadas. Curso em andamento: as parcelas futuras saem e as
 * vencidas seguem como divida, como em cancelar a matricula; curso ja
 * concluido fica (e o historico dele). Sai tambem da lista de espera e das
 * aulas futuras reservadas. Retorna quantas matriculas encerrou.
 */
function endStudentEnrollments(studentId: Id): number {
  const today = todayISO();
  const ts = nowIso();
  let ended = 0;
  for (const e of store.enrollments) {
    if (e.studentId !== studentId || e.status === "canceled") continue;
    const g = store.classGroups.find((x) => x.id === e.classGroupId);
    if (e.course && g && isCourseEnded(g, today)) continue;
    e.status = "canceled";
    e.canceledAt = ts;
    e.cancellationReason = "Aluno inativado";
    ended += 1;
    if (!e.course) continue;
    for (const c of store.charges) {
      if (c.kind !== "course" || c.enrollmentId !== e.id || !isFutureOpenInstallment(c, today)) continue;
      c.status = "canceled";
      c.canceledBy = "system";
      c.cancelReason = "Matrícula encerrada na inativação";
      c.updatedAt = ts;
      cancelOnlinePaymentsForCharge(c.id);
    }
  }
  for (const w of store.waitlist) {
    if (w.studentId === studentId && w.status === "waiting") w.status = "canceled";
  }
  for (const r of store.reservations) {
    const date = r.sessionId.split("~")[1];
    if (r.studentId !== studentId || r.status !== "reserved" || !date || date <= today) continue;
    r.status = "canceled";
    const chargeId = r.chargeId || r.cobrancaId;
    const charge = chargeId ? store.charges.find((c) => c.id === chargeId) : undefined;
    if (charge && (charge.status === "pending" || charge.status === "overdue")) {
      charge.status = "canceled";
      charge.canceledBy = "system";
      charge.updatedAt = ts;
      cancelOnlinePaymentsForCharge(charge.id);
    }
  }
  return ended;
}

export const clientsService = {
  list(filter?: ClientFilter): Promise<Client[]> {
    return simulateRead(async () => {
      if (isSupabaseOrganization(store.organization.id)) {
        const dbClients = await listClientsFromDb(store.organization.id, filter);
        const dbIds = new Set(dbClients.map((c) => c.id));
        store.clients = [
          ...store.clients.filter((c) => c.organizationId === store.organization.id ? !dbIds.has(c.id) : true),
          ...dbClients,
        ];
        return clone(dbClients);
      }

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

  listPaginated(filter?: ClientFilter): Promise<PaginatedResult<Client>> {
    return simulateRead(async () => {
      if (isSupabaseOrganization(store.organization.id)) {
        const paginated = await listClientsPaginatedFromDb(store.organization.id, filter);
        const dbIds = new Set(paginated.items.map((c) => c.id));
        store.clients = [
          ...store.clients.filter((c) => c.organizationId === store.organization.id ? !dbIds.has(c.id) : true),
          ...paginated.items,
        ];
        return clone(paginated);
      }

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
      if (filter?.planId) {
        result = result.filter((c) => c.planId === filter.planId);
      }
      if (filter?.membershipStatus) {
        result = result.filter((c) => c.membershipStatus === filter.membershipStatus);
      }

      const sorted = [...result].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      return clone(paginateArray(sorted, filter?.page, filter?.pageSize));
    });
  },

  getById(id: Id): Promise<Client> {
    return simulateRead(async () => {
      if (isSupabaseOrganization(store.organization.id)) {
        const dbClient = await getClientFromDb(store.organization.id, id);
        if (!dbClient) throw notFoundError(NOT_FOUND);
        const idx = store.clients.findIndex((c) => c.id === id);
        if (idx !== -1) {
          store.clients[idx] = dbClient;
        } else {
          store.clients.push(dbClient);
        }
        return clone(dbClient);
      }

      const found = store.clients.find((c) => c.id === id);
      if (!found) throw notFoundError(NOT_FOUND);
      return clone(found);
    });
  },

  create(payload: CreateClient): Promise<Client> {
    return simulateWrite(async () => {
      validateClient(payload, { partial: false });

      if (isSupabaseOrganization(store.organization.id)) {
        const client = await createClientInDb(store.organization.id, payload);
        store.clients.push(client);

        if (client.planId && payload.initialCharge && (payload.initialCharge.amountCents > 0 || client.discount?.scholarship)) {
          const initialCharge = initialMembershipCharge(client, payload.initialCharge);
          store.charges.push(initialCharge);
          await insertChargesInDb([initialCharge]);
        }
        ensurePlanlessScholarCharges(client);

        auditLogService.record({
          action: "created",
          target: { type: "client", id: client.id, label: client.name },
          predicate: `criou o ${clientNoun()} ${client.name}`,
        });
        return clone(client);
      }

      const ts = nowIso();
      const client: Client = {
        id: newId(),
        organizationId: store.organization.id,
        name: payload.name.trim(),
        phone: payload.phone.trim(),
        email: payload.email?.trim() || undefined,
        birthDate: payload.birthDate || undefined,
        guardians: payload.guardians?.length ? payload.guardians : undefined,
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
      // Bolsa integral gera a 1a mensalidade como "Isento" (R$ 0).
      if (client.planId && payload.initialCharge && (payload.initialCharge.amountCents > 0 || client.discount?.scholarship)) {
        store.charges.push(initialMembershipCharge(client, payload.initialCharge));
      }
      ensurePlanlessScholarCharges(client);

      auditLogService.record({
        action: "created",
        target: { type: "client", id: client.id, label: client.name },
        predicate: `criou o ${clientNoun()} ${client.name}`,
      });
      return clone(client);
    });
  },

  update(id: Id, payload: UpdateClient): Promise<Client> {
    return simulateWrite(async () => {
      let current = store.clients.find((c) => c.id === id);
      if (isSupabaseOrganization(store.organization.id)) {
        if (!current) {
          const fetched = await getClientFromDb(store.organization.id, id);
          if (fetched) {
            store.clients.push(fetched);
            current = fetched;
          }
        }
        if (!current) throw notFoundError(NOT_FOUND);
        validateClient(payload, { partial: true, current });

        const updated = await updateClientInDb(store.organization.id, id, payload);
        const idx = store.clients.findIndex((c) => c.id === id);
        if (idx !== -1) store.clients[idx] = updated;
        else store.clients.push(updated);

        auditLogService.record({
          action: current.status !== "active" && updated.status === "active" ? "activated" : "updated",
          target: { type: "client", id: updated.id, label: updated.name },
          predicate: `${current.status !== "active" && updated.status === "active" ? "reativou" : "atualizou"} o ${clientNoun()} ${updated.name}`,
        });
        return clone(updated);
      }

      const idx = store.clients.findIndex((c) => c.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      current = store.clients[idx];
      validateClient(payload, { partial: true, current });
      const ts = nowIso();
      const updated: Client = {
        ...current,
        ...payload,
        updatedAt: ts,
      };
      // Volta do aluno (reativado ou assinatura retomada): a cobranca recomeca
      // na data da volta, pela regra dele (proporcional ou mes cheio). O tempo
      // parado nao e cobrado e o que ja foi cobrado nao se repete.
      const stopped = (c: Client) =>
        c.status !== "active" || c.membershipStatus === "paused" || c.membershipStatus === "canceled";
      const resumed = stopped(current) && !stopped(updated);
      const today = todayISO();
      if (
        resumed &&
        updated.planId &&
        (payload.planStartDate === undefined || payload.planStartDate === current.planStartDate) &&
        (updated.planStartDate ?? "") < today
      ) {
        updated.planStartDate = today;
      }
      store.clients[idx] = updated;

      // Pausa ou cancelamento da assinatura: periodos que ainda nao comecaram
      // deixam de valer (como na inativacao); o que ja foi usado segue em aberto.
      if (!stopped(current) && stopped(updated) && updated.status === "active") {
        // "Depois do uso": o periodo em uso vira cobranca agora.
        const pausedPlan = current.planId ? store.plans.find((p) => p.id === current.planId) : undefined;
        if (pausedPlan && studentMembershipTerms(current, pausedPlan).timing === "postpaid") {
          chargeStartedMembershipPeriods(current, today);
        }
        cancelOpenMembershipCharges(updated.id, today, "Cancelada na pausa da assinatura");
      }

      // Troca de plano ou de data de inicio: as mensalidades em aberto do
      // arranjo anterior a partir da nova vigencia deixam de valer.
      const planChanged =
        Boolean(updated.planId) &&
        (current.planId !== updated.planId || (!resumed && current.planStartDate !== updated.planStartDate));
      if (planChanged && current.planId && updated.planStartDate) {
        cancelOpenMembershipCharges(updated.id, updated.planStartDate, "Substituída pela troca de plano", {
          inclusive: true,
          replaced: true,
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
          beforeTerms.dueDay !== afterTerms.dueDay ||
          // Desconto ou bolsa (valor, tipo, validade) muda o valor dos proximos periodos.
          JSON.stringify(current.discount ?? null) !== JSON.stringify(updated.discount ?? null));
      if (!planChanged && rulesChanged && current.planId === updated.planId) {
        cancelOpenMembershipCharges(updated.id, todayISO(), "Substituída pela troca da regra de cobrança", {
          replaced: true,
        });
      }
      if (
        updated.planId &&
        payload.initialCharge &&
        (payload.initialCharge.amountCents > 0 || updated.discount?.scholarship)
      ) {
        const charge = initialMembershipCharge(updated, payload.initialCharge);
        // Mesmo periodo ja cobrado (em qualquer plano, ex.: mes pago no plano
        // antigo) nao gera outra mensalidade.
        const taken =
          charge.periodStart && charge.periodEnd
            ? membershipPeriodTaken(updated.id, updated.planId, {
                periodStart: charge.periodStart,
                periodEnd: charge.periodEnd,
                competence: charge.competence ?? "",
                cycleIndex: charge.cycleIndex ?? 1,
              })
            : false;
        if (!taken) store.charges.push(charge);
      }

      // Bolsista integral sem plano: trocar a bolsa ou sair dela cancela as
      // isentas futuras; continuando bolsista, recria pela regra nova.
      if (
        isPlanlessScholar(current) &&
        (!isPlanlessScholar(updated) ||
          JSON.stringify(current.discount) !== JSON.stringify(updated.discount) ||
          current.planStartDate !== updated.planStartDate)
      ) {
        cancelOpenMembershipCharges(updated.id, todayISO(), "Substituída pela troca da bolsa", {
          replaced: true,
        });
      }
      ensurePlanlessScholarCharges(updated);

      auditLogService.record({
        action: current.status !== "active" && updated.status === "active" ? "activated" : "updated",
        target: { type: "client", id: updated.id, label: updated.name },
        predicate: `${current.status !== "active" && updated.status === "active" ? "reativou" : "atualizou"} o ${clientNoun()} ${updated.name}`,
      });
      return clone(updated);
    });
  },

  // remove = inativacao logica; cliente permanece no historico.
  /**
   * Inativa o aluno. Mensalidades de periodos futuros sempre saem. As em aberto
   * de periodos ja iniciados ficam como divida, salvo `cancelOpenCharges`: ai
   * sao canceladas como decisao do usuario (motivo "Aluno inativado"), contam
   * como nao cobradas e podem ser reabertas.
   */
  remove(id: Id, opts: { cancelOpenCharges?: boolean } = {}): Promise<void> {
    return simulateWrite(async () => {
      let before = store.clients.find((c) => c.id === id);
      if (isSupabaseOrganization(store.organization.id)) {
        if (!before) {
          const fetched = await getClientFromDb(store.organization.id, id);
          if (fetched) {
            store.clients.push(fetched);
            before = fetched;
          }
        }
        if (!before) throw notFoundError(NOT_FOUND);

        await inactivateClientInDb(store.organization.id, id);

        const idx = store.clients.findIndex((c) => c.id === id);
        if (idx !== -1) {
          store.clients[idx] = { ...store.clients[idx], status: "inactive", updatedAt: nowIso() };
        }
        const ended = endStudentEnrollments(id);
        const canceled = cancelOpenMembershipCharges(id, todayISO(), "Cancelada na inativação do aluno");

        auditLogService.record({
          action: "inactivated",
          target: { type: "client", id, label: before.name },
          predicate: `inativou o ${clientNoun()} ${before.name}${ended > 0 ? `, encerrou ${plural(ended, "matrícula", "matrículas")}` : ""}${canceled > 0 ? ` e cancelou ${plural(canceled, "mensalidade futura", "mensalidades futuras")}` : ""}`,
        });
        return;
      }

      const idx = store.clients.findIndex((c) => c.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      before = store.clients[idx];
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
      const ended = endStudentEnrollments(id);
      // Escolha do usuario: nao cobrar tambem o que ja estava em aberto.
      let waivedDebt = 0;
      if (opts.cancelOpenCharges) {
        const ts = nowIso();
        for (const c of store.charges) {
          if (c.kind !== "membership" || c.studentId !== id) continue;
          if (c.status !== "pending" && c.status !== "overdue") continue;
          c.status = "canceled";
          c.canceledBy = "user";
          c.cancelReason = "Aluno inativado";
          c.updatedAt = ts;
          waivedDebt += 1;
        }
      }
      auditLogService.record({
        action: "inactivated",
        target: { type: "client", id, label: name },
        predicate: `inativou o ${clientNoun()} ${name}${ended > 0 ? `, encerrou ${plural(ended, "matrícula", "matrículas")}` : ""}${charged > 0 ? `, gerou ${plural(charged, "mensalidade do período usado", "mensalidades dos períodos usados")}` : ""}${canceled > 0 ? ` e cancelou ${plural(canceled, "mensalidade futura", "mensalidades futuras")}` : ""}${waivedDebt > 0 ? `; cancelou também ${plural(waivedDebt, "mensalidade em aberto", "mensalidades em aberto")} (não serão cobradas)` : ""}`,
      });
    });
  },

  getProgressionOverview(studentId: Id): Promise<StudentProgressionOverview> {
    return simulateRead(async () => {
      let client = store.clients.find((c) => c.id === studentId);
      if (isSupabaseOrganization(store.organization.id) && !client) {
        const dbClient = await getClientFromDb(store.organization.id, studentId);
        if (dbClient) {
          store.clients.push(dbClient);
          client = dbClient;
        }
      }
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

  /** Sugestoes de pontos fortes e focos para a modalidade (aprendidas do uso). */
  getProgressionTermSuggestions(modalityId: Id): Promise<ProgressionTermSuggestions> {
    return simulateRead(() => ({
      strengths: progressionTermSuggestions("strengths", modalityId),
      goals: progressionTermSuggestions("goals", modalityId),
    }));
  },

  saveModalityProgression(
    studentId: Id,
    progression: Omit<StudentModalityProgression, "updatedAt">,
  ): Promise<Client> {
    return simulateWrite(async () => {
      assertCanManageProgression(studentId, { modalityId: progression.modalityId });

      if (isSupabaseOrganization(store.organization.id)) {
        const updated = await saveModalityProgressionInDb(store.organization.id, studentId, progression);
        const idx = store.clients.findIndex((c) => c.id === studentId);
        if (idx !== -1) store.clients[idx] = updated;
        else store.clients.push(updated);

        auditLogService.record({
          action: "updated",
          target: { type: "client", id: updated.id, label: updated.name },
          predicate: `atualizou o progresso de ${updated.name} (${progression.levelName})`,
        });
        return clone(updated);
      }

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
    toLevelColor?: ProgressionBeltColor;
    toSubLevel: number;
    maxSubLevels?: number;
    date: DateISO;
    attendancesCompleted?: number;
    monthsInLevel?: number;
    isExam?: boolean;
    notes?: string;
    examiner?: string;
  }): Promise<Client> {
    return simulateWrite(async () => {
      assertCanManageProgression(payload.studentId, { modalityId: payload.modalityId });
      if (payload.date > todayISO()) {
        throw validationError([{ field: "date", message: "A data não pode ser futura." }]);
      }

      if (isSupabaseOrganization(store.organization.id)) {
        const updated = await promoteStudentInDb(store.organization.id, payload);
        const idx = store.clients.findIndex((c) => c.id === payload.studentId);
        if (idx !== -1) store.clients[idx] = updated;
        else store.clients.push(updated);

        auditLogService.record({
          action: "updated",
          target: { type: "client", id: updated.id, label: updated.name },
          predicate: `graduou ${updated.name} para ${payload.toLevelName}${payload.toSubLevel > 0 ? ` (${payload.toSubLevel}º grau)` : ""}`,
        });
        return clone(updated);
      }

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
        examiner: payload.examiner?.trim() || undefined,
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
        origin: prev?.origin,
        originAcademy: prev?.originAcademy,
        originTeacher: prev?.originTeacher,
        nextExamDate: undefined,
        strengths: prev?.strengths ?? [],
        goals: prev?.goals ?? [],
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

  /** Registro de aula de um aluno: anotacao, avanco de metas e lembrete. */
  addClassRecord(payload: CreateStudentClassRecord): Promise<Client> {
    return simulateWrite(async () => {
      assertRecordDate(payload.date);
      assertCanManageProgression(payload.studentId, {
        modalityId: payload.modalityId,
        classGroupId: payload.classGroupId,
        sessionId: payload.sessionId,
      });
      const note = payload.note?.trim() ?? "";
      const nextClassNote = payload.nextClassNote?.trim() ?? "";
      const hasGoals = (payload.goalProgress ?? []).some((g) => (g.amount ?? 0) > 0 || g.completed);
      if (!note && !nextClassNote && !hasGoals) {
        throw validationError([{ field: "note", message: "Escreva uma anotação ou avance uma meta." }]);
      }
      const idx = await ensureClientInStore(payload.studentId);
      const progression = progressionOf(store.clients[idx], payload.modalityId, payload.date);
      const goalProgress = applyGoalProgress(progression, payload.goalProgress, payload.date);
      const record = newClassRecord({
        date: payload.date,
        classGroupId: payload.classGroupId,
        classGroupName: payload.classGroupName,
        sessionId: payload.sessionId,
        tone: payload.tone,
        note,
        ...(nextClassNote ? { nextClassNote } : {}),
        ...(goalProgress.length ? { goalProgress } : {}),
      });
      progression.evaluations = [record, ...progression.evaluations];
      const updated = await writeProgression(idx, progression);
      auditLogService.record({
        action: "updated",
        target: { type: "client", id: updated.id, label: updated.name },
        predicate: `registrou a aula de ${updated.name}${payload.classGroupName ? ` (${payload.classGroupName})` : ""}`,
      });
      return clone(updated);
    });
  },

  /**
   * Registro da turma inteira pela chamada: um registro na ficha de cada aluno
   * marcado (tom ou anotacao). Com anotacao da turma, todos os listados ganham.
   * Devolve quantos registros criou.
   */
  addClassRecords(payload: CreateClassRecordsBatch): Promise<number> {
    return simulateWrite(async () => {
      assertRecordDate(payload.date);
      for (const entry of payload.entries) {
        assertCanManageProgression(entry.studentId, {
          modalityId: payload.modalityId,
          classGroupId: payload.classGroupId,
          sessionId: payload.sessionId,
        });
      }
      const classNote = payload.classNote?.trim() ?? "";
      let created = 0;
      let removed = 0;
      for (const entry of payload.entries) {
        const note = entry.note?.trim() ?? "";
        let idx = store.clients.findIndex((c) => c.id === entry.studentId);
        if (idx === -1 && isSupabaseOrganization(store.organization.id)) {
          const dbClient = await getClientFromDb(store.organization.id, entry.studentId);
          if (dbClient) {
            store.clients.push(dbClient);
            idx = store.clients.length - 1;
          }
        }
        if (idx === -1) continue;
        // Um registro por aluno e aula: registrar de novo troca o anterior.
        const current = store.clients[idx].progressions?.[payload.modalityId];
        const hadRecord = Boolean(current?.evaluations.some((e) => e.sessionId === payload.sessionId));
        if (!entry.tone && !note && !classNote) {
          if (hadRecord && current) {
            const progression = progressionOf(store.clients[idx], payload.modalityId, payload.date);
            progression.evaluations = progression.evaluations.filter((e) => e.sessionId !== payload.sessionId);
            await writeProgression(idx, progression);
            removed += 1;
          }
          continue;
        }
        const progression = progressionOf(store.clients[idx], payload.modalityId, payload.date);
        progression.evaluations = [
          newClassRecord({
            date: payload.date,
            classGroupId: payload.classGroupId,
            classGroupName: payload.classGroupName,
            sessionId: payload.sessionId,
            tone: entry.tone ?? "general",
            note,
            ...(classNote ? { classNote } : {}),
          }),
          ...progression.evaluations.filter((e) => e.sessionId !== payload.sessionId),
        ];
        await writeProgression(idx, progression);
        created += 1;
      }
      if (created === 0 && removed === 0) {
        throw validationError([{ field: "entries", message: "Marque ao menos um aluno ou escreva a anotação da turma." }]);
      }
      auditLogService.record({
        action: "updated",
        target: { type: "class_group", id: payload.classGroupId, label: payload.classGroupName },
        predicate: `registrou a aula de ${payload.classGroupName} (${plural(created, "aluno", "alunos")})`,
      });
      return created;
    });
  },

  /** Pontos fortes do aluno na modalidade. */
  updateStrengths(studentId: Id, modalityId: Id, strengths: string[]): Promise<Client> {
    return simulateWrite(async () => {
      assertCanManageProgression(studentId, { modalityId });
      const idx = await ensureClientInStore(studentId);
      const progression = progressionOf(store.clients[idx], modalityId, todayISO());
      progression.strengths = [...new Set(strengths.map((t) => t.trim()).filter(Boolean))];
      const updated = await writeProgression(idx, progression);
      return clone(updated);
    });
  },

  addGoal(studentId: Id, modalityId: Id, input: { title: string; target?: number }): Promise<Client> {
    return simulateWrite(async () => {
      assertCanManageProgression(studentId, { modalityId });
      const title = input.title.trim();
      const fields: ApiErrorField[] = [];
      if (!title) fields.push({ field: "title", message: "Informe a meta." });
      else if (title.length > 80) fields.push({ field: "title", message: "Use no máximo 80 caracteres." });
      if (input.target !== undefined && (!Number.isInteger(input.target) || input.target < 1)) {
        fields.push({ field: "target", message: "Informe uma quantidade maior que zero." });
      }
      if (fields.length > 0) throw validationError(fields);
      const idx = await ensureClientInStore(studentId);
      const progression = progressionOf(store.clients[idx], modalityId, todayISO());
      progression.goals = [
        ...progression.goals,
        {
          id: newId(),
          title,
          ...(input.target ? { target: input.target } : {}),
          progress: 0,
          createdAt: nowIso(),
        },
      ];
      const updated = await writeProgression(idx, progression);
      return clone(updated);
    });
  },

  /** Marca a meta como feita ou reabre. */
  setGoalCompleted(studentId: Id, modalityId: Id, goalId: Id, completed: boolean): Promise<Client> {
    return simulateWrite(async () => {
      assertCanManageProgression(studentId, { modalityId });
      const idx = await ensureClientInStore(studentId);
      const progression = progressionOf(store.clients[idx], modalityId, todayISO());
      const goal = findGoal(progression, goalId);
      if (completed) {
        goal.completedAt = todayISO();
        if (goal.target) goal.progress = goal.target;
      } else {
        delete goal.completedAt;
        if (goal.target && goal.progress >= goal.target) goal.progress = goal.target - 1;
      }
      const updated = await writeProgression(idx, progression);
      return clone(updated);
    });
  },

  removeGoal(studentId: Id, modalityId: Id, goalId: Id): Promise<Client> {
    return simulateWrite(async () => {
      assertCanManageProgression(studentId, { modalityId });
      const idx = await ensureClientInStore(studentId);
      const progression = progressionOf(store.clients[idx], modalityId, todayISO());
      findGoal(progression, goalId);
      progression.goals = progression.goals.filter((g) => g.id !== goalId);
      const updated = await writeProgression(idx, progression);
      return clone(updated);
    });
  },
};
