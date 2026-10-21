import type {
  ApiErrorField,
  Charge,
  ChargeFilter,
  ChargeStatus,
  ChargeView,
  Client,
  CreateExtraCharge,
  CreatePlan,
  Id,
  ManualPaymentDetails,
  PaginatedResult,
  PaymentMethod,
  Plan,
  PlanFilter,
  UpdatePlan,
} from "@gestarahub/contracts";
import { paginateArray } from "@gestarahub/contracts";
import {
  chargesDueIn,
  classBillingMode,
  describeCharge,
  MAX_INSTALLMENTS,
  resolveMembershipTerms,
  splitInstallments,
  type CompetenceCharge,
} from "@gestarahub/core/billing";
import {
  coversPeriod,
  isPlanlessScholar as coreIsPlanlessScholar,
  membershipCompetencesToGenerate,
  membershipPeriodTaken as coreMembershipPeriodTaken,
  membershipStartDate,
  planMembershipCharges,
  plannedMembershipCharge,
  scholarshipChargeFields as coreScholarshipChargeFields,
  type ChargePeriod as CoreChargePeriod,
  type MembershipWorld,
  type PlannedMembershipCharge,
} from "@gestarahub/core/membership-generation";
import { formatCents, plural } from "@gestarahub/core/format";
import { addMonths, format, parseISO } from "date-fns";
import { persist, store } from "@/mocks/store";
import {
  apiError,
  newId,
  notFoundError,
  nowIso,
  simulateRead,
  simulateWrite,
  textIncludes,
  validationError,
} from "@/mocks/helpers";
import { auditLogService } from "./auditLogService";
import { applyRecurringAutoPayments, cancelOnlinePaymentsForCharge } from "./onlinePaymentsService";
import { cancelOnlinePaymentsForChargeInDb } from "./onlinePaymentsBackend";
import { paidAtFromDate, paidOnNote } from "./payment-date";
import { generateMembershipChargesAction } from "./membershipBackend";
import { isSupabaseOrganization } from "@/lib/session";
import {
  createPlanInDb,
  deleteChargesByIdsInDb,
  insertChargesInDb,
  listChargesFromDb,
  listChargesPaginatedFromDb,
  listPlansFromDb,
  updateChargeInDb,
  updatePlanInDb,
} from "./billingBackend";

/**
 * Modelo 3 (financeiro). Registro/status, sem gateway. As mensalidades seguem
 * as Regras de Cobranca (antecipado/depois do uso x proporcional/mes cheio),
 * calculadas pelo motor unico em @gestarahub/core/billing. Assinatura pausada
 * ou cancelada nao gera cobranca.
 */

function clone<T>(value: T): T {
  return structuredClone(value);
}

function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function studentName(id: Id): string {
  return store.clients.find((c) => c.id === id)?.name ?? "";
}
function planOf(id?: Id): Plan | undefined {
  return id ? store.plans.find((p) => p.id === id) : undefined;
}
function className(id?: Id): string | undefined {
  return id ? store.classGroups.find((t) => t.id === id)?.name : undefined;
}

/** "2026-10" -> "10/2026". */
function competenceLabel(competence: string): string {
  const [year, month] = competence.split("-");
  return `${month}/${year}`;
}

/**
 * Atraso e derivado na leitura: uma cobranca em aberto com vencimento passado
 * esta atrasada hoje, mesmo que tenha sido gravada como pendente.
 */
function effectiveStatus(c: Charge): ChargeStatus {
  if (c.status === "pending" || c.status === "overdue") {
    return c.dueDate < todayISO() ? "overdue" : "pending";
  }
  return c.status;
}

/**
 * Fechamento de professor em que a cobranca paga ja entrou no % (competencia).
 * Fechamento antigo, sem a lista, vale pelo mes do periodo e pela data.
 */
function teacherPayClosedIn(c: Charge): string | undefined {
  if (c.status !== "paid" || (c.kind !== "membership" && c.kind !== "course")) return undefined;
  const competence = (c.periodStart ?? c.competence ?? "").slice(0, 7);
  const payout = (store.teacherPayouts ?? []).find(
    (p) =>
      p.status !== "open" &&
      (p.countedChargeIds
        ? p.countedChargeIds.includes(c.id)
        : p.competence === competence && Boolean(c.paidAt && p.closedAt && c.paidAt <= p.closedAt)),
  );
  return payout?.competence;
}

function toChargeView(c: Charge): ChargeView {
  return {
    ...c,
    teacherPayClosedIn: teacherPayClosedIn(c),
    status: effectiveStatus(c),
    cycleIndex: c.cycleIndex ?? 1,
    cycleTotal: c.cycleTotal ?? 1,
    studentName: studentName(c.studentId),
    studentPhone: store.clients.find((s) => s.id === c.studentId)?.phone || undefined,
    // Bolsista integral sem plano: rotulo proprio, sempre mensal.
    planName: planOf(c.planId)?.name ?? (!c.planId && c.scholarshipPercent ? "Bolsa integral" : undefined),
    planPeriod: planOf(c.planId)?.period ?? (!c.planId && c.scholarshipPercent ? "monthly" : undefined),
    className: className(c.classGroupId),
  };
}

function chargeLabel(c: Charge): string {
  return describeCharge(c, studentName(c.studentId));
}

function recordChargeEvent(
  c: Charge,
  action: "status_changed" | "cancelled",
  verb: string,
  reason?: string,
): void {
  auditLogService.record({
    action,
    target: { type: "charge", id: c.id, label: chargeLabel(c) },
    predicate: `${verb} ${chargeLabel(c)} (${formatCents(c.amountCents)}, vence ${c.dueDate.split("-").reverse().join("/")})${reason ? `: ${reason}` : ""}`,
  });
}

/**
 * D8: pagamento online ou por Pix Automatico nao se desfaz (seria estorno, fora
 * da demonstracao). Manual e dado antigo (sem `paidVia`) seguem permitidos.
 */
function assertNotPaidOnline(c: Charge, verb: "desfazer" | "cancelar"): void {
  if (c.paidVia !== "online" && c.paidVia !== "recurring") return;
  const via = c.paidVia === "online" ? "online" : "pelo Pix Automático";
  throw apiError(
    "VALIDATION",
    `Não é possível ${verb} um pagamento feito ${via}: seria um estorno, que não existe nesta versão.`,
    { httpStatus: 409 },
  );
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EXTRA_DESCRIPTION_MAX = 80;

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && DATE_RE.test(value) && !Number.isNaN(parseISO(value).getTime());
}

function validateExtraCharge(payload: Partial<CreateExtraCharge>): void {
  const fields: ApiErrorField[] = [];
  if (!payload.studentId) fields.push({ field: "studentId", message: "Selecione o aluno." });
  const description = payload.description?.trim() ?? "";
  if (!description) {
    fields.push({ field: "description", message: "Descreva a cobrança." });
  } else if (description.length > EXTRA_DESCRIPTION_MAX) {
    fields.push({ field: "description", message: `Use no máximo ${EXTRA_DESCRIPTION_MAX} caracteres.` });
  }
  if (!Number.isInteger(payload.totalCents) || (payload.totalCents ?? 0) <= 0) {
    fields.push({ field: "totalCents", message: "Informe o valor." });
  }
  if (!isValidDate(payload.firstDueDate)) {
    fields.push({ field: "firstDueDate", message: "Informe o vencimento." });
  }
  const n = payload.installments;
  if (!Number.isInteger(n) || (n ?? 0) < 1 || (n ?? 0) > MAX_INSTALLMENTS) {
    fields.push({ field: "installments", message: `Escolha de 1 a ${MAX_INSTALLMENTS} parcelas.` });
  } else if (Number.isInteger(payload.totalCents) && (payload.totalCents ?? 0) < (n ?? 1)) {
    // Parcela de R$ 0 nao e cobranca.
    fields.push({ field: "installments", message: "Cada parcela precisa de pelo menos R$ 0,01." });
  }
  if (fields.length > 0) throw validationError(fields);
}

function validatePlan(payload: Partial<CreatePlan>): void {
  const fields: ApiErrorField[] = [];
  if (!payload.name || !payload.name.trim()) {
    fields.push({ field: "name", message: "Informe o nome do plano." });
  }
  if (payload.priceCents === undefined || payload.priceCents <= 0) {
    fields.push({ field: "priceCents", message: "Informe um valor maior que zero." });
  }
  if (fields.length > 0) throw validationError(fields);
}

type ChargePeriod = CoreChargePeriod;

/** Periodo ja tem mensalidade deste aluno (regra em @gestarahub/core/membership-generation). */
export function membershipPeriodTaken(
  studentId: Id,
  planId: Id | undefined,
  period: ChargePeriod,
  exceptChargeId?: Id,
): boolean {
  return coreMembershipPeriodTaken(store.charges, studentId, planId, period, exceptChargeId);
}

function hasMembershipCharge(studentId: Id, planId: Id | undefined, planned: CompetenceCharge): boolean {
  return membershipPeriodTaken(studentId, planId, planned);
}

/** Alunos ativos no plano (inclui o legado: sem plano proprio, em turma com o plano). */
function activeStudentsInPlan(planId: Id): number {
  const ids = new Set<Id>();
  for (const c of store.clients) {
    if (c.status === "active" && c.planId === planId) ids.add(c.id);
  }
  for (const e of store.enrollments) {
    if (e.status !== "active") continue;
    const turma = store.classGroups.find((t) => t.id === e.classGroupId);
    if (!turma || turma.planId !== planId || classBillingMode(turma) !== "membership" || e.paysWithPackage) continue;
    const student = store.clients.find((c) => c.id === e.studentId);
    if (student && student.status === "active" && !student.planId) ids.add(student.id);
  }
  return ids.size;
}

/**
 * Bolsa do aluno nesta mensalidade: percentual, valor sem bolsa e status.
 * Bolsa integral (valor final zero) nasce "Isento" (`waived`), nunca pendente.
 */
export const scholarshipChargeFields = coreScholarshipChargeFields;

/** Isento (bolsa integral) nao tem pagamento, desfazer nem cancelamento manual. */
function assertNotWaived(c: Charge): void {
  if (c.status === "waived") {
    throw apiError(
      "VALIDATION",
      "Mensalidade isenta. Para cobrar, ajuste a bolsa ou o desconto no cadastro do aluno.",
      { httpStatus: 409 },
    );
  }
}

/** Bolsista integral sem plano: so ele tem mensalidade (isenta) sem plano. */
export const isPlanlessScholar = coreIsPlanlessScholar;

/**
 * Mensalidades "Isento" do bolsista integral sem plano na competencia: mensais,
 * no vencimento dele, sem valor de referencia. Para depois de `validUntil`
 * (sem plano nao ha valor cheio para voltar). Idempotente. Retorna quantas criou.
 */
export function planlessScholarCharges(student: Client, competence: string): number {
  if (!isPlanlessScholar(student) || student.status !== "active") return 0;
  if (student.membershipStatus === "paused" || student.membershipStatus === "canceled") return 0;
  const terms = resolveMembershipTerms(
    {
      period: "monthly",
      planPriceCents: 0,
      startDate: membershipStartDate(student),
      strategy: student.billingStrategy,
      timing: student.cyclePaymentTiming,
      dueDay: student.dueDay,
    },
    store.organization.settings,
  );
  const validUntil = student.discount?.validUntil;
  let created = 0;
  for (const planned of chargesDueIn(terms, competence)) {
    if (validUntil && planned.periodStart > validUntil) continue;
    if (hasMembershipCharge(student.id, undefined, planned)) continue;
    store.charges.push({
      ...membershipCharge(student.id, undefined, planned),
      status: "waived",
      scholarshipPercent: 100,
      notes: undefined,
    });
    created += 1;
  }
  return created;
}

function membershipCharge(
  studentId: Id,
  plan: Plan | undefined,
  planned: CompetenceCharge,
  classGroupId?: Id,
): Charge {
  const student = store.clients.find((c) => c.id === studentId);
  return withRecordFields(plannedMembershipCharge(student, studentId, plan, planned, classGroupId));
}

/** Da mensalidade planejada (core) a cobranca do store: id, organizacao, unidade e datas. */
function withRecordFields(planned: PlannedMembershipCharge): Charge {
  const ts = nowIso();
  return {
    ...planned,
    id: newId(),
    organizationId: store.organization.id,
    unitId: store.unit.id,
    createdAt: ts,
    updatedAt: ts,
  };
}

/** Inicio da vigencia de cobranca do aluno (data local, nao UTC). */

/** Termos de cobranca do aluno: a regra dele prevalece sobre a da academia. */
export function studentMembershipTerms(student: Client, plan: Plan) {
  return resolveMembershipTerms(
    {
      period: plan.period,
      planPriceCents: plan.priceCents,
      startDate: membershipStartDate(student),
      strategy: student.billingStrategy,
      timing: student.cyclePaymentTiming,
      dueDay: student.dueDay,
      discount: student.discount,
    },
    store.organization.settings,
  );
}

/**
 * Cancela as mensalidades em aberto de um aluno cujo periodo comeca a partir
 * de `fromDate` (troca de plano, inativacao). Pagas e ja canceladas ficam como
 * estao. Uso interno de outros services, dentro da propria escrita deles.
 */
export function cancelOpenMembershipCharges(
  studentId: Id,
  fromDate: string,
  note: string,
  /** `replaced`: outra cobranca toma o lugar (troca), nao e perda. */
  opts: { inclusive?: boolean; replaced?: boolean } = {},
): number {
  let count = 0;
  for (const c of store.charges) {
    if (c.kind !== "membership" || c.studentId !== studentId) continue;
    // Isento (bolsa) futuro tambem sai: a regra nova recria o que valer.
    if (c.status !== "pending" && c.status !== "overdue" && c.status !== "waived") continue;
    const start = c.periodStart ?? c.dueDate;
    const affected = opts.inclusive ? start >= fromDate : start > fromDate;
    if (!affected) continue;
    c.status = "canceled";
    c.canceledBy = "system";
    c.replaced = opts.replaced || undefined;
    c.notes = note;
    c.updatedAt = nowIso();
    count += 1;
  }
  return count;
}

/**
 * Garante a mensalidade dos periodos ja iniciados ate `untilDate` que ainda nao
 * foram gerados (ex.: aluno "depois do uso" inativado antes da geracao do mes
 * do vencimento). Olha as competencias de `untilDate` em diante, onde vencem os
 * periodos em uso; o valor e o vencimento vem do motor. Retorna quantas criou.
 */
export function chargeStartedMembershipPeriods(student: Client, untilDate: string): number {
  if (!student.planId) return 0;
  if (student.membershipStatus === "paused" || student.membershipStatus === "canceled") return 0;
  const plan = planOf(student.planId);
  if (!plan) return 0;
  const terms = studentMembershipTerms(student, plan);
  const base = parseISO(`${untilDate.slice(0, 7)}-01`);
  let created = 0;
  // O periodo em uso vence no maximo 2 meses depois (mensal "depois do uso").
  for (let k = 0; k <= 2; k++) {
    const competence = format(addMonths(base, k), "yyyy-MM");
    for (const planned of chargesDueIn(terms, competence)) {
      if (planned.periodStart > untilDate) continue;
      if (hasMembershipCharge(student.id, plan.id, planned)) continue;
      store.charges.push(membershipCharge(student.id, plan, planned));
      created += 1;
    }
  }
  return created;
}


/**
 * Geracao automatica na leitura: todo mes desde o inicio da vigencia mais
 * antiga ate o atual (mes em que ninguem abriu o app tambem gera, e o atraso
 * nao muda com a navegacao) e o mes consultado, se ja chegou. Meses futuros
 * aparecem quando chegarem. Idempotente. Sem auditoria (e o sistema).
 */
export function autoGenerateMembershipCharges(...competences: (string | undefined)[]): number {
  const world = storeMembershipWorld();
  const planned = planMembershipCharges(world, membershipCompetencesToGenerate(world, competences));
  for (const p of planned) store.charges.push(withRecordFields(p));
  if (planned.length > 0) persist();
  return planned.length;
}

/**
 * Garante as mensalidades geradas antes de uma leitura. Conta real: gera no
 * servidor (`generateMembershipChargesAction`) e traz do banco; nunca cria so
 * no navegador, onde a mensalidade nao chegava ao banco (doc 15, fatia 1).
 * Demonstracao: gera no store, como antes. Retorna quantas criou.
 */
export async function ensureMembershipCharges(...competences: (string | undefined)[]): Promise<number> {
  if (isSupabaseOrganization(store.organization.id)) {
    const requested = competences.filter((c): c is string => Boolean(c));
    let created = 0;
    try {
      created = await generateMembershipChargesAction(store.organization.id, requested);
    } catch (err) {
      console.error("[billingService] Erro ao gerar mensalidades no servidor:", err);
    }
    await syncChargesFromDb(store.organization.id);
    return created;
  }
  return autoGenerateMembershipCharges(...competences);
}

/** Gera so a competencia pedida (botao "Gerar cobrancas"). Retorna quantas criou. */
function generateMembershipChargesFor(competence: string): number {
  const planned = planMembershipCharges(storeMembershipWorld(), [competence]);
  for (const p of planned) store.charges.push(withRecordFields(p));
  return planned.length;
}

/** O store no formato que o planejamento puro recebe. */
function storeMembershipWorld(): MembershipWorld {
  return {
    clients: store.clients,
    plans: store.plans,
    classGroups: store.classGroups,
    enrollments: store.enrollments,
    charges: store.charges,
    settings: store.organization.settings,
    today: todayISO(),
  };
}

export async function syncPlansFromDb(organizationId: string): Promise<void> {
  if (!isSupabaseOrganization(organizationId)) return;
  const dbPlans = await listPlansFromDb(organizationId);
  const dbMap = new Map(dbPlans.map((p) => [p.id, p]));
  for (let i = 0; i < store.plans.length; i++) {
    const existing = store.plans[i];
    const fromDb = dbMap.get(existing.id);
    if (fromDb) {
      store.plans[i] = fromDb;
      dbMap.delete(existing.id);
    }
  }
  for (const newPlan of dbMap.values()) {
    store.plans.push(newPlan);
  }
}

export async function syncChargesFromDb(organizationId: string): Promise<void> {
  if (!isSupabaseOrganization(organizationId)) return;
  const dbCharges = await listChargesFromDb(organizationId);
  const dbMap = new Map(dbCharges.map((c) => [c.id, c]));
  for (let i = 0; i < store.charges.length; i++) {
    const existing = store.charges[i];
    const fromDb = dbMap.get(existing.id);
    if (fromDb) {
      store.charges[i] = fromDb;
      dbMap.delete(existing.id);
    }
  }
  for (const newCharge of dbMap.values()) {
    store.charges.push(newCharge);
  }
  // Mensalidade que so existe neste navegador (gerada aqui antes da fatia 1 do
  // doc 15) nao vale: a geracao agora e no servidor e o banco e a fonte.
  const inDb = new Set(dbCharges.map((c) => c.id));
  store.charges = store.charges.filter(
    (c) => c.organizationId !== organizationId || c.kind !== "membership" || inDb.has(c.id),
  );
}

export const billingService = {
  // --- Planos -------------------------------------------------------------
  listPlans(filter?: PlanFilter): Promise<Plan[]> {
    return simulateRead(async () => {
      await syncPlansFromDb(store.organization.id);
      let result = store.plans;
      if (filter?.search) {
        const term = filter.search;
        result = result.filter((p) => textIncludes(p.name, term));
      }
      if (filter?.period) result = result.filter((p) => p.period === filter.period);
      if (filter?.status) result = result.filter((p) => p.status === filter.status);
      return clone(
        [...result].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      );
    });
  },

  createPlan(payload: CreatePlan): Promise<Plan> {
    return simulateWrite(async () => {
      validatePlan(payload);
      const ts = nowIso();
      const plan: Plan = {
        ...payload,
        organizationId: store.organization.id,
        period: payload.period || "monthly",
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
      };
      if (isSupabaseOrganization(store.organization.id)) {
        await createPlanInDb(plan);
      }
      store.plans.push(plan);
      auditLogService.record({
        action: "created",
        target: { type: "plan", id: plan.id, label: plan.name },
        predicate: `criou o plano ${plan.name} (${formatCents(plan.priceCents)})`,
      });
      return clone(plan);
    });
  },

  updatePlan(id: Id, payload: UpdatePlan): Promise<Plan> {
    return simulateWrite(async () => {
      const idx = store.plans.findIndex((p) => p.id === id);
      if (idx === -1) throw notFoundError("Plano não encontrado.");
      const before = store.plans[idx];
      validatePlan({ ...before, ...payload });
      // Mudar a periodicidade reinterpretaria os periodos ja cobrados dos alunos.
      if (payload.period && payload.period !== before.period && activeStudentsInPlan(id) > 0) {
        throw validationError([
          {
            field: "period",
            message:
              "Não é possível mudar a periodicidade de um plano com alunos ativos. Crie um novo plano.",
          },
        ]);
      }
      if (isSupabaseOrganization(store.organization.id)) {
        await updatePlanInDb(id, payload, store.organization.id);
      }
      store.plans[idx] = {
        ...before,
        ...payload,
        updatedAt: nowIso(),
      };
      const after = store.plans[idx];
      auditLogService.record({
        action: before.status !== after.status ? (after.status === "active" ? "activated" : "inactivated") : "updated",
        target: { type: "plan", id, label: after.name },
        predicate:
          before.status !== after.status
            ? `${after.status === "active" ? "reativou" : "inativou"} o plano ${after.name}`
            : `atualizou o plano ${after.name}`,
        changes:
          before.priceCents !== after.priceCents
            ? [
                {
                  field: "priceCents",
                  label: "Valor",
                  before: formatCents(before.priceCents),
                  after: formatCents(after.priceCents),
                },
              ]
            : undefined,
      });
      return clone(after);
    });
  },

  // --- Cobrancas (Charges) ------------------------------------------------
  listCharges(filter?: ChargeFilter): Promise<ChargeView[]> {
    return simulateRead(async () => {
      // Mensalidades do mes atual (e do mes consultado, se ja chegou) nascem sozinhas;
      // na conta real, no servidor, e ja chegam sincronizadas.
      await syncChargesFromDb(store.organization.id);
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
          persist();
          if (toDelete.length > 0 && isSupabaseOrganization(store.organization.id)) {
            await deleteChargesByIdsInDb(toDelete, store.organization.id);
          }
        }
      }
      let result = store.charges.map(toChargeView);
      if (filter?.competence) {
        result = result.filter((c) => c.competence === filter.competence);
      }
      if (filter?.kind) result = result.filter((c) => c.kind === filter.kind);
      if (filter?.status) result = result.filter((c) => c.status === filter.status);
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
    return simulateRead(async () => {
      await syncChargesFromDb(store.organization.id);
      await ensureMembershipCharges(filter?.competence);
      applyRecurringAutoPayments();

      if (isSupabaseOrganization(store.organization.id)) {
        const paginated = await listChargesPaginatedFromDb(store.organization.id, filter);
        const views = paginated.items.map(toChargeView);
        return clone({
          items: views.sort(
            (a, b) =>
              a.studentName.localeCompare(b.studentName, "pt-BR") ||
              a.dueDate.localeCompare(b.dueDate),
          ),
          total: paginated.total,
          page: paginated.page,
          pageSize: paginated.pageSize,
          totalPages: paginated.totalPages,
          hasMore: paginated.hasMore,
        });
      }

      let result = store.charges.map(toChargeView);
      if (filter?.competence) {
        result = result.filter((c) => c.competence === filter.competence);
      }
      if (filter?.kind) result = result.filter((c) => c.kind === filter.kind);
      if (filter?.status) result = result.filter((c) => c.status === filter.status);
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
    return simulateWrite(async () => {
      // Conta real: so a competencia pedida, no servidor (mesma regra e protecao contra duplicata).
      let created: number;
      if (isSupabaseOrganization(store.organization.id)) {
        created = await generateMembershipChargesAction(store.organization.id, [competence]);
        await syncChargesFromDb(store.organization.id);
      } else {
        created = generateMembershipChargesFor(competence);
      }

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
    return simulateWrite(async () => {
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
      if (isSupabaseOrganization(store.organization.id)) {
        await insertChargesInDb(created);
      }
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

  /** Registra o pagamento manual: dia do pagamento (padrao hoje) e comprovantes. */
  markPaid(id: Id, method?: PaymentMethod, details: ManualPaymentDetails = {}): Promise<ChargeView> {
    return simulateWrite(async () => {
      const c = store.charges.find((x) => x.id === id);
      if (!c) throw notFoundError("Cobrança não encontrada.");
      assertNotWaived(c);
      // Pagar de novo trocaria a forma e a data, e apagaria o recebimento online.
      if (c.status === "paid") {
        throw apiError("VALIDATION", "Esta cobrança já está paga.", { httpStatus: 409 });
      }
      const paidAt = paidAtFromDate(details.paidOn);
      c.status = "paid";
      c.paidAt = paidAt;
      c.method = method;
      c.paidVia = "manual";
      if (details.receipts?.length) c.attachments = [...(c.attachments ?? []), ...details.receipts];
      c.updatedAt = nowIso();
      if (isSupabaseOrganization(store.organization.id)) {
        await updateChargeInDb(c.id, {
          status: "paid",
          paidAt: c.paidAt,
          method: c.method,
          paidVia: c.paidVia,
          attachments: c.attachments,
        }, store.organization.id);
        await cancelOnlinePaymentsForChargeInDb(
          c.id,
          store.organization.id,
          "Baixa manual da cobrança",
        );
      }
      // Pago na mao: o Pix/link em aberto nao vale mais.
      cancelOnlinePaymentsForCharge(c.id, "Baixa manual da cobrança");
      recordChargeEvent(c, "status_changed", `registrou${paidOnNote(details.paidOn)} o pagamento da`);
      return clone(toChargeView(c));
    });
  },

  // Desfaz o pagamento (volta a ficar em aberto; o atraso e derivado na leitura).
  markPending(id: Id): Promise<ChargeView> {
    return simulateWrite(async () => {
      const c = store.charges.find((x) => x.id === id);
      if (!c) throw notFoundError("Cobrança não encontrada.");
      assertNotWaived(c);
      assertNotPaidOnline(c, "desfazer");
      c.status = "pending";
      c.paidAt = undefined;
      c.method = undefined;
      c.paidVia = undefined;
      c.attachments = undefined;
      c.updatedAt = nowIso();
      if (isSupabaseOrganization(store.organization.id)) {
        await updateChargeInDb(c.id, {
          status: "pending",
          paidAt: undefined,
          method: undefined,
          paidVia: undefined,
          attachments: [],
        }, store.organization.id);
      }
      recordChargeEvent(c, "status_changed", "desfez o pagamento da");
      return clone(toChargeView(c));
    });
  },

  // Cancela a cobrança (mantém o título no histórico sem compor o total a receber).
  cancelCharge(id: Id, reason?: string): Promise<ChargeView> {
    return simulateWrite(async () => {
      const c = store.charges.find((x) => x.id === id);
      if (!c) throw notFoundError("Cobrança não encontrada.");
      assertNotWaived(c);
      // Cancelar uma paga online apagaria o recebimento, como o desfazer.
      if (c.status === "paid") assertNotPaidOnline(c, "cancelar");
      c.status = "canceled";
      c.canceledBy = "user";
      c.cancelReason = reason?.trim() || undefined;
      c.paidAt = undefined;
      c.method = undefined;
      c.paidVia = undefined;
      c.updatedAt = nowIso();
      if (isSupabaseOrganization(store.organization.id)) {
        await updateChargeInDb(c.id, {
          status: "canceled",
          canceledBy: "user",
          cancelReason: c.cancelReason,
          paidAt: undefined,
          method: undefined,
          paidVia: undefined,
        }, store.organization.id);
        await cancelOnlinePaymentsForChargeInDb(
          c.id,
          store.organization.id,
          c.cancelReason || "Cobrança cancelada",
        );
      }
      cancelOnlinePaymentsForCharge(c.id, c.cancelReason || "Cobrança cancelada");
      recordChargeEvent(c, "cancelled", "cancelou a", c.cancelReason);
      return clone(toChargeView(c));
    });
  },

  // Reverte o cancelamento manual da cobrança (volta a ficar em aberto). Cancelada
  // pelo sistema (troca de plano/regra, inativacao, saida da aula) nao reabre:
  // voltaria a cobrar um periodo que o novo arranjo ja cobre.
  reopenCharge(id: Id): Promise<ChargeView> {
    return simulateWrite(async () => {
      const c = store.charges.find((x) => x.id === id);
      if (!c) throw notFoundError("Cobrança não encontrada.");
      if (c.status !== "canceled") {
        throw apiError("VALIDATION", "Só é possível reabrir uma cobrança cancelada.", { httpStatus: 409 });
      }
      if (c.canceledBy === "system") {
        throw apiError(
          "VALIDATION",
          "Esta cobrança foi cancelada automaticamente pelo sistema e não pode ser reaberta.",
          { httpStatus: 409 },
        );
      }
      // Reabrir nao pode duplicar: outra mensalidade ja cobre o periodo (ex.:
      // o plano foi trocado depois do cancelamento).
      const { periodStart, periodEnd } = c;
      if (
        c.kind === "membership" &&
        periodStart &&
        periodEnd &&
        store.charges.some(
          (o) =>
            o.id !== c.id &&
            o.kind === "membership" &&
            o.studentId === c.studentId &&
            o.status !== "canceled" &&
            coversPeriod(o, {
              periodStart,
              periodEnd,
              competence: c.competence ?? "",
              cycleIndex: c.cycleIndex ?? 1,
            }),
        )
      ) {
        throw apiError(
          "VALIDATION",
          "Já existe outra mensalidade para este período. Cancele-a antes de reabrir esta.",
          { httpStatus: 409 },
        );
      }
      c.status = "pending";
      c.canceledBy = undefined;
      c.cancelReason = undefined;
      c.updatedAt = nowIso();
      if (isSupabaseOrganization(store.organization.id)) {
        await updateChargeInDb(c.id, {
          status: "pending",
          canceledBy: undefined,
          cancelReason: undefined,
        }, store.organization.id);
      }
      recordChargeEvent(c, "status_changed", "reabriu a");
      return clone(toChargeView(c));
    });
  },

  /**
   * Remove as mensalidades em aberto ou canceladas da competencia, para gerar de
   * novo. Pagas nunca sao apagadas (sao registro de recebimento) e aulas
   * avulsas ficam (nao sao recriadas pela geracao).
   */
  clearCharges(competence: string): Promise<{ deleted: number; keptPaid: number }> {
    return simulateWrite(async () => {
      const inCompetence = store.charges.filter(
        (c) => c.kind === "membership" && c.competence === competence,
      );
      const keptPaid = inCompetence.filter((c) => c.status === "paid").length;
      const removed = new Set(inCompetence.filter((c) => c.status !== "paid").map((c) => c.id));
      if (isSupabaseOrganization(store.organization.id) && removed.size > 0) {
        await deleteChargesByIdsInDb(Array.from(removed), store.organization.id);
      }
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

