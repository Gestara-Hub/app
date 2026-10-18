import type {
  ApiErrorField,
  AttendanceStatus,
  Charge,
  ClassGroup,
  CreateLessonPackage,
  DateISO,
  Id,
  LessonPackage,
  LessonPackageFilter,
  SellPackage,
  SessionPackageCandidate,
  SessionRosterEntry,
  StudentPackage,
  StudentPackageFilter,
  StudentPackageView,
  UpdateLessonPackage,
} from "@gestarahub/contracts";
import { classBillingMode, MAX_INSTALLMENTS, splitInstallments } from "@gestarahub/core/billing";
import { formatCents, plural } from "@gestarahub/core/format";
import {
  carriedLots,
  carryOverSources,
  leftoverLots,
  lessonOriginAt,
  MAX_PACKAGE_LESSONS,
  mergeLots,
  MAX_PACKAGE_VALIDITY_DAYS,
  packageExpiresAt,
  packageState,
  pickPackageFor,
  usablePackagesFor,
  usageReasonFor,
} from "@gestarahub/core/packages";
import { format, parseISO } from "date-fns";
import { store } from "@/mocks/store";
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
import { cancelOnlinePaymentsForCharge } from "./onlinePaymentsService";
import { withKind } from "@/lib/text";

/**
 * Pacote de aulas (doc 20, fase C). Catalogo do espaco (`LessonPackage`),
 * venda ao aluno (`StudentPackage` + cobrancas "package") e o gasto de aula
 * na chamada. As regras puras (saldo, validade, qual pacote paga a aula,
 * renovacao) ficam em @gestarahub/core/packages.
 */

function clone<T>(value: T): T {
  return structuredClone(value);
}

function todayISO(): DateISO {
  return format(new Date(), "yyyy-MM-dd");
}

function studentName(id: Id): string {
  return store.clients.find((c) => c.id === id)?.name ?? "";
}

function modalityNames(ids: Id[]): string[] {
  return ids
    .map((id) => store.categories.find((c) => c.id === id)?.name)
    .filter((name): name is string => Boolean(name));
}

function classNames(ids: Id[] | undefined): string[] {
  return (ids ?? [])
    .map((id) => store.classGroups.find((g) => g.id === id)?.name)
    .filter((name): name is string => Boolean(name));
}

function toView(p: StudentPackage): StudentPackageView {
  return {
    ...p,
    studentName: studentName(p.studentId),
    ...packageState(p, todayISO()),
    modalityNames: modalityNames(p.modalityIds),
    classNames: classNames(p.classGroupIds),
  };
}

/** Turma de pacote ou de mensalidade aceita pacote; sem cobranca e curso, nunca. */
export function acceptsPackages(g: Pick<ClassGroup, "billingMode">): boolean {
  const mode = classBillingMode(g);
  return mode === "package" || mode === "membership";
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && DATE_RE.test(value) && !Number.isNaN(parseISO(value).getTime());
}

function validatePackage(payload: Partial<CreateLessonPackage>): void {
  const fields: ApiErrorField[] = [];
  if (!payload.name || !payload.name.trim()) {
    fields.push({ field: "name", message: "Informe o nome do pacote." });
  }
  const lessons = payload.lessons;
  if (!Number.isInteger(lessons) || (lessons ?? 0) < 1 || (lessons ?? 0) > MAX_PACKAGE_LESSONS) {
    fields.push({ field: "lessons", message: `Informe de 1 a ${MAX_PACKAGE_LESSONS} aulas.` });
  }
  if (!Number.isInteger(payload.priceCents) || (payload.priceCents ?? 0) <= 0) {
    fields.push({ field: "priceCents", message: "Informe um valor maior que zero." });
  }
  const days = payload.validityDays;
  if (days !== undefined && (!Number.isInteger(days) || days < 1 || days > MAX_PACKAGE_VALIDITY_DAYS)) {
    fields.push({ field: "validityDays", message: `A validade vai de 1 a ${MAX_PACKAGE_VALIDITY_DAYS} dias.` });
  }
  const invalidClass = (payload.classGroupIds ?? []).some((id) => {
    const g = store.classGroups.find((x) => x.id === id);
    return !g || !acceptsPackages(g);
  });
  if (invalidClass) {
    fields.push({ field: "classGroupIds", message: "Escolha turmas de pacote ou de mensalidade." });
  }
  if (fields.length > 0) throw validationError(fields);
}

function validateSale(payload: Partial<SellPackage>): void {
  const fields: ApiErrorField[] = [];
  if (!payload.studentId) fields.push({ field: "studentId", message: "Selecione o aluno." });
  if (!payload.packageId) fields.push({ field: "packageId", message: "Selecione o pacote." });
  if (!Number.isInteger(payload.priceCents) || (payload.priceCents ?? 0) <= 0) {
    fields.push({ field: "priceCents", message: "Informe o valor." });
  }
  const n = payload.installments;
  if (!Number.isInteger(n) || (n ?? 0) < 1 || (n ?? 0) > MAX_INSTALLMENTS) {
    fields.push({ field: "installments", message: `Escolha de 1 a ${MAX_INSTALLMENTS} parcelas.` });
  } else if (Number.isInteger(payload.priceCents) && (payload.priceCents ?? 0) > 0 && (payload.priceCents ?? 0) < (n ?? 1)) {
    // Parcela de R$ 0 nao e cobranca.
    fields.push({ field: "installments", message: "Cada parcela precisa de pelo menos R$ 0,01." });
  }
  if (!isValidDate(payload.firstDueDate)) {
    fields.push({ field: "firstDueDate", message: "Informe o 1º vencimento." });
  }
  if (fields.length > 0) throw validationError(fields);
}

/** Campos do pacote coerentes: nome sem espacos sobrando, validade ausente = sem validade. */
function normalizePackage<T extends Partial<CreateLessonPackage>>(payload: T): T {
  return {
    ...payload,
    name: payload.name?.trim(),
    validityDays: payload.validityDays || undefined,
    classGroupIds: [...new Set(payload.classGroupIds ?? [])],
    modalityIds: [...new Set(payload.modalityIds ?? [])],
    absenceConsumes: payload.absenceConsumes ?? true,
  };
}

const ACTIVE_STATUSES = new Set(["pending", "overdue"]);

// --- Gasto de aula na chamada (usado pelo turmasService) ---------------------

/** Pacote do aluno que ja gastou uma aula nesta aula (uma por aluno x aula). */
function usageOf(studentId: Id, sessionId: Id): { pkg: StudentPackage; index: number } | null {
  for (const pkg of store.studentPackages) {
    if (pkg.studentId !== studentId) continue;
    const index = pkg.usages.findIndex((u) => u.sessionId === sessionId);
    if (index !== -1) return { pkg, index };
  }
  return null;
}

/**
 * Aula devolvida a um pacote renovado: o saldo dele ja foi para o pacote novo,
 * entao a aula devolvida vai junto (o novo ganha uma aula trazida, com a
 * origem da posicao liberada, para guardar o valor da aula no repasse).
 * Chamar depois de tirar o uso (`lessonsUsed` ja e a posicao liberada).
 */
function creditSuccessor(pkg: StudentPackage): void {
  let next = pkg.renewedIntoId ? store.studentPackages.find((p) => p.id === pkg.renewedIntoId) : undefined;
  const seen = new Set<Id>();
  while (next && next.status === "renewed" && next.renewedIntoId && !seen.has(next.id)) {
    seen.add(next.id);
    const nextId: Id = next.renewedIntoId;
    next = store.studentPackages.find((p) => p.id === nextId);
  }
  if (!next || next.status !== "active") return;
  const origin = lessonOriginAt(pkg, pkg.lessonsUsed);
  next.carriedFrom = mergeLots([...carriedLots(next), { fromPackageId: origin, lessons: 1 }]);
  next.lessonsTotal += 1;
  next.carriedOverLessons = (next.carriedOverLessons ?? 0) + 1;
  next.updatedAt = nowIso();
}

export type PackageUsageChange = "added" | "updated" | "reverted" | "none";

/**
 * Deixa o pacote do aluno de acordo com a chamada desta aula (idempotente por
 * aluno x aula). `status` ausente = o aluno nao paga esta aula com pacote, ou
 * a presenca foi desmarcada: devolve a aula, se tinha gastado.
 * Presenca gasta; falta sem justificativa gasta se o pacote mandar; falta
 * justificada nunca. O pacote e o que vence primeiro entre os validos na data
 * da aula que cobrem a modalidade. Sem pacote com saldo, nada e gasto.
 */
export function syncPackageUsage(input: {
  studentId: Id;
  sessionId: Id;
  classGroupId: Id;
  modalityId?: Id;
  date: DateISO;
  status?: AttendanceStatus;
}): PackageUsageChange {
  const existing = usageOf(input.studentId, input.sessionId);
  const ts = nowIso();
  if (existing) {
    const { pkg, index } = existing;
    const reason = input.status ? usageReasonFor(input.status, pkg.absenceConsumes) : null;
    if (reason) {
      if (pkg.usages[index].reason === reason) return "none";
      pkg.usages[index] = { ...pkg.usages[index], reason };
      pkg.updatedAt = ts;
      return "updated";
    }
    pkg.usages.splice(index, 1);
    pkg.lessonsUsed = pkg.usages.length;
    pkg.updatedAt = ts;
    if (pkg.status === "renewed") creditSuccessor(pkg);
    return "reverted";
  }
  if (!input.status) return "none";
  const owned = store.studentPackages.filter((p) => p.studentId === input.studentId);
  const pkg = pickPackageFor(owned, {
    classGroupId: input.classGroupId,
    modalityId: input.modalityId,
    date: input.date,
  });
  if (!pkg) return "none";
  const reason = usageReasonFor(input.status, pkg.absenceConsumes);
  if (!reason) return "none";
  pkg.usages.push({ sessionId: input.sessionId, classGroupId: input.classGroupId, date: input.date, reason });
  pkg.lessonsUsed = pkg.usages.length;
  pkg.updatedAt = ts;
  return "added";
}

/** Turma da aula para os pacotes: id, modalidade e forma de cobranca. */
type PackageClass = Pick<ClassGroup, "id" | "modalityId" | "billingMode">;

/**
 * Saldo mostrado na chamada para quem paga a aula com pacote: a soma dos
 * pacotes que valem nesta aula (o que ja gastou esta aula entra). Ultima aula
 * so quando todos juntos acabam. Sem nenhum: "Sem pacote".
 */
export function packageRosterInfo(
  studentId: Id,
  sessionId: Id,
  g: PackageClass,
  date: DateISO,
): Pick<SessionRosterEntry, "packageRemaining" | "packageTotal" | "packageLastLesson" | "noPackage"> {
  const used = usageOf(studentId, sessionId)?.pkg;
  const usable = acceptsPackages(g)
    ? usablePackagesFor(
        store.studentPackages.filter((p) => p.studentId === studentId),
        { classGroupId: g.id, modalityId: g.modalityId, date },
      )
    : [];
  const counted = used && !usable.some((p) => p.id === used.id) ? [used, ...usable] : usable;
  if (counted.length === 0) return { noPackage: true };
  const left = counted.reduce((sum, p) => sum + Math.max(0, p.lessonsTotal - p.lessonsUsed), 0);
  return {
    packageRemaining: left,
    packageTotal: counted.reduce((sum, p) => sum + p.lessonsTotal, 0),
    // Com a aula ja gasta, era a ultima se nao sobrou nada; antes, se sobra uma.
    packageLastLesson: used ? left === 0 : left === 1,
  };
}

/** O aluno tem pacote valido com saldo para esta turma na data? */
export function hasUsablePackage(studentId: Id, g: PackageClass, date: DateISO): boolean {
  if (!acceptsPackages(g)) return false;
  return Boolean(
    pickPackageFor(
      store.studentPackages.filter((p) => p.studentId === studentId),
      { classGroupId: g.id, modalityId: g.modalityId, date },
    ),
  );
}

/** Alunos ativos com pacote valido para a aula (fora de `exceptIds`), por nome. */
export function packageCandidatesFor(
  g: PackageClass,
  date: DateISO,
  exceptIds: Set<Id>,
): SessionPackageCandidate[] {
  if (!acceptsPackages(g)) return [];
  const byStudent = new Map<Id, number>();
  for (const pkg of store.studentPackages) {
    if (exceptIds.has(pkg.studentId) || byStudent.has(pkg.studentId)) continue;
    const owned = store.studentPackages.filter((p) => p.studentId === pkg.studentId);
    const usable = usablePackagesFor(owned, { classGroupId: g.id, modalityId: g.modalityId, date });
    if (usable.length > 0) {
      byStudent.set(
        pkg.studentId,
        usable.reduce((sum, p) => sum + p.lessonsTotal - p.lessonsUsed, 0),
      );
    }
  }
  const out: SessionPackageCandidate[] = [];
  for (const [studentId, remaining] of byStudent) {
    const student = store.clients.find((c) => c.id === studentId);
    if (!student || student.status !== "active") continue;
    out.push({ studentId, studentName: student.name, remaining });
  }
  return out.sort((a, b) => a.studentName.localeCompare(b.studentName, "pt-BR"));
}

// --- Service -----------------------------------------------------------------

export const packagesService = {
  // --- Catalogo ------------------------------------------------------------
  listPackages(filter?: LessonPackageFilter): Promise<LessonPackage[]> {
    return simulateRead(() => {
      let result = store.lessonPackages;
      if (filter?.search) {
        const term = filter.search;
        result = result.filter((p) => textIncludes(p.name, term));
      }
      if (filter?.status) result = result.filter((p) => p.status === filter.status);
      return clone([...result].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
    });
  },

  createPackage(input: CreateLessonPackage): Promise<LessonPackage> {
    return simulateWrite(() => {
      const payload = normalizePackage(input);
      validatePackage(payload);
      const ts = nowIso();
      const pkg: LessonPackage = {
        ...payload,
        name: payload.name ?? "",
        status: payload.status ?? "active",
        organizationId: store.organization.id,
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
      };
      store.lessonPackages.push(pkg);
      auditLogService.record({
        action: "created",
        target: { type: "lesson_package", id: pkg.id, label: pkg.name },
        predicate: `criou o ${withKind("pacote", pkg.name)} (${plural(pkg.lessons, "aula", "aulas")}, ${formatCents(pkg.priceCents)})`,
      });
      return clone(pkg);
    });
  },

  /** Mudar o pacote vale para as proximas vendas; o que ja foi vendido fica como esta. */
  updatePackage(id: Id, payload: UpdateLessonPackage): Promise<LessonPackage> {
    return simulateWrite(() => {
      const idx = store.lessonPackages.findIndex((p) => p.id === id);
      if (idx === -1) throw notFoundError("Pacote não encontrado.");
      const before = store.lessonPackages[idx];
      const next = normalizePackage({ ...before, ...payload });
      validatePackage(next);
      store.lessonPackages[idx] = { ...before, ...next, name: next.name ?? before.name, updatedAt: nowIso() };
      const after = store.lessonPackages[idx];
      const statusChanged = before.status !== after.status;
      auditLogService.record({
        action: statusChanged ? (after.status === "active" ? "activated" : "inactivated") : "updated",
        target: { type: "lesson_package", id, label: after.name },
        predicate: statusChanged
          ? `${after.status === "active" ? "reativou" : "inativou"} o ${withKind("pacote", after.name)}`
          : `atualizou o ${withKind("pacote", after.name)}`,
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

  // --- Pacotes dos alunos --------------------------------------------------
  listStudentPackages(filter?: StudentPackageFilter): Promise<StudentPackageView[]> {
    return simulateRead(() => {
      let result = store.studentPackages;
      if (filter?.studentId) result = result.filter((p) => p.studentId === filter.studentId);
      if (filter?.status) result = result.filter((p) => p.status === filter.status);
      return clone(
        [...result]
          .sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt) || b.createdAt.localeCompare(a.createdAt))
          .map(toView),
      );
    });
  },

  /**
   * Venda do pacote: cria o pacote do aluno e as cobrancas (a vista ou em ate
   * 12 parcelas mensais, como a cobranca avulsa). Regra 6: o saldo dos pacotes
   * ativos nas mesmas modalidades vem para este, com a validade deste; os
   * antigos ficam "Renovado".
   */
  sellPackage(payload: SellPackage): Promise<StudentPackageView> {
    return simulateWrite(() => {
      validateSale(payload);
      const student = store.clients.find((c) => c.id === payload.studentId);
      if (!student) throw validationError([{ field: "studentId", message: "Aluno não encontrado." }]);
      if (student.status !== "active") {
        throw validationError([
          { field: "studentId", message: "Aluno inativo. Reative o cadastro para vender o pacote." },
        ]);
      }
      const catalog = store.lessonPackages.find((p) => p.id === payload.packageId);
      if (!catalog) throw validationError([{ field: "packageId", message: "Pacote não encontrado." }]);
      if (catalog.status !== "active") {
        throw validationError([{ field: "packageId", message: "Pacote inativo. Reative-o em Planos para vender." }]);
      }

      const today = todayISO();
      const ts = nowIso();
      const id = newId();
      const owned = store.studentPackages.filter((p) => p.studentId === student.id);
      // Renova so o mesmo pacote do catalogo; outro pacote fica separado.
      const carry = carryOverSources(owned, catalog.id, today);
      // De onde vem cada aula trazida (o pacote que a vendeu), antes de renovar.
      const carriedFrom = mergeLots(carry.sources.flatMap((source) => leftoverLots(source, source.lessonsUsed)));
      for (const source of carry.sources) {
        source.status = "renewed";
        source.renewedIntoId = id;
        source.updatedAt = ts;
      }

      const parts = splitInstallments(payload.priceCents, payload.installments, payload.firstDueDate);
      const isSplit = parts.length > 1;
      const groupId = isSplit ? newId() : undefined;
      const charges: Charge[] = parts.map((part) => ({
        id: newId(),
        organizationId: store.organization.id,
        unitId: store.unit.id,
        studentId: student.id,
        kind: "package",
        description: catalog.name,
        studentPackageId: id,
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
      store.charges.push(...charges);

      const sold: StudentPackage = {
        id,
        organizationId: store.organization.id,
        unitId: store.unit.id,
        studentId: student.id,
        packageId: catalog.id,
        name: catalog.name,
        lessonsTotal: catalog.lessons + carry.lessons,
        lessonsUsed: 0,
        purchasedAt: today,
        expiresAt: packageExpiresAt(today, catalog.validityDays),
        classGroupIds: catalog.classGroupIds?.length ? [...catalog.classGroupIds] : undefined,
        modalityIds: [...catalog.modalityIds],
        absenceConsumes: catalog.absenceConsumes,
        status: "active",
        carriedOverLessons: carry.lessons > 0 ? carry.lessons : undefined,
        carriedFrom: carry.lessons > 0 ? carriedFrom : undefined,
        renewedFromId: carry.sources[0]?.id,
        chargeIds: charges.map((c) => c.id),
        usages: [],
        createdAt: ts,
        updatedAt: ts,
      };
      store.studentPackages.push(sold);
      auditLogService.record({
        action: "created",
        // Mesmo alvo do cancelamento: o filtro "Pacote de aulas" mostra a venda.
        target: { type: "lesson_package", id: sold.id, label: `${catalog.name} de ${student.name}` },
        predicate: `vendeu o ${withKind("pacote", catalog.name)} para ${student.name} (${formatCents(payload.priceCents)}${isSplit ? `, em ${parts.length} parcelas` : ""})${carry.lessons > 0 ? `, com ${plural(carry.lessons, "aula trazida", "aulas trazidas")} do pacote anterior` : ""}`,
      });
      return clone(toView(sold));
    });
  },

  /**
   * Desfaz a venda de um pacote ainda sem aula usada: cancela as cobrancas em
   * aberto (e o Pix ou link delas); as pagas ficam. Se o pacote trouxe saldo
   * de outro, o anterior volta a valer.
   */
  cancelStudentPackage(id: Id): Promise<StudentPackageView> {
    return simulateWrite(() => {
      const pkg = store.studentPackages.find((p) => p.id === id);
      if (!pkg) throw notFoundError("Pacote não encontrado.");
      if (pkg.status === "canceled") {
        throw apiError("VALIDATION", "Este pacote já foi cancelado.", { httpStatus: 409 });
      }
      if (pkg.status === "renewed") {
        throw apiError("VALIDATION", "O saldo deste pacote já passou para o pacote novo.", { httpStatus: 409 });
      }
      if (pkg.usages.length > 0) {
        throw apiError("VALIDATION", "O pacote já tem aulas usadas.", { httpStatus: 409 });
      }
      const ts = nowIso();
      pkg.status = "canceled";
      pkg.updatedAt = ts;
      let canceled = 0;
      for (const c of store.charges) {
        if (!pkg.chargeIds.includes(c.id) || !ACTIVE_STATUSES.has(c.status)) continue;
        c.status = "canceled";
        c.canceledBy = "system";
        c.cancelReason = "Pacote cancelado";
        c.updatedAt = ts;
        cancelOnlinePaymentsForCharge(c.id);
        canceled += 1;
      }
      for (const previous of store.studentPackages) {
        if (previous.renewedIntoId !== pkg.id || previous.status !== "renewed") continue;
        previous.status = "active";
        previous.renewedIntoId = undefined;
        previous.updatedAt = ts;
      }
      const name = studentName(pkg.studentId);
      auditLogService.record({
        action: "cancelled",
        target: { type: "lesson_package", id: pkg.id, label: `${pkg.name} de ${name}` },
        predicate: `cancelou o ${withKind("pacote", pkg.name)} de ${name}${canceled > 0 ? ` e ${plural(canceled, "cobrança em aberto", "cobranças em aberto")}` : ""}`,
      });
      return clone(toView(pkg));
    });
  },
};

