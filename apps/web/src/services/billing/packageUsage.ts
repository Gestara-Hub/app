import type {
  AttendanceStatus,
  ClassGroup,
  DateISO,
  Id,
  SessionPackageCandidate,
  SessionRosterEntry,
  StudentPackage,
} from "@gestarahub/contracts";
import {
  carriedLots,
  lessonOriginAt,
  mergeLots,
  pickPackageFor,
  usablePackagesFor,
  usageReasonFor,
} from "@gestarahub/core/packages";
import { store } from "@/services/world/store";
import { nowIso } from "@/services/world/ops";

import { acceptsPackages } from "./packageRules";

export { acceptsPackages };

// --- Gasto de aula na chamada (usado pelo turmasService) ---------------------

/** Pacote do aluno que ja gastou uma aula nesta aula (uma por aluno x aula). */
/** A aula ja gastou um pacote do aluno? */
export function hasPackageUsage(studentId: Id, sessionId: Id): boolean {
  return usageOf(studentId, sessionId) !== null;
}

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
