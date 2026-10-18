import { differenceInCalendarDays, parseISO } from "date-fns";
import type { DateISO, Id, StudentPackageStatus } from "@gestarahub/contracts";
import { modalitiesOverlap, packageState } from "@gestarahub/core/packages";

/**
 * Pacotes de aulas acabando ("Para fazer hoje" do Dashboard e o modelo
 * "Pacote acabando" na mensagem para o aluno; doc 20, fase D). Avisos da
 * regra 5 (ultima aula e 7 dias antes de vencer), o vencido ha ate 7 dias e o
 * usado ate o fim ainda valido (doc 22, item 8), para lembrar de renovar.
 * Quem ja comprou outro pacote nas mesmas modalidades sai da lista.
 */

/** Vencido aparece por ate 7 dias depois do ultimo dia valido. */
export const EXPIRED_RECENT_DAYS = 7;

export type PackageEndingReason = "expired" | "used_up" | "expiring" | "last_lesson";

export interface PackageLike {
  id: Id;
  studentId: Id;
  status: StudentPackageStatus;
  lessonsTotal: number;
  lessonsUsed: number;
  purchasedAt: DateISO;
  createdAt: string;
  expiresAt?: DateISO;
  modalityIds: Id[];
}

export interface PackageEnding<T extends PackageLike> {
  pkg: T;
  reason: PackageEndingReason;
  /** Dias ate vencer (negativo = venceu ha N dias). So com validade. */
  daysToExpire?: number;
}

/** Comprado depois (mesma data: criado depois) e nao cancelado. */
function isNewer(other: PackageLike, pkg: PackageLike): boolean {
  if (other.id === pkg.id || other.studentId !== pkg.studentId || other.status === "canceled") return false;
  return (
    other.purchasedAt > pkg.purchasedAt ||
    (other.purchasedAt === pkg.purchasedAt && other.createdAt > pkg.createdAt)
  );
}

function reasonOf(pkg: PackageLike, today: DateISO): PackageEndingReason | null {
  const state = packageState(pkg, today);
  if (state.isExpired) {
    if (!pkg.expiresAt) return null;
    const ago = differenceInCalendarDays(parseISO(today), parseISO(pkg.expiresAt));
    return ago <= EXPIRED_RECENT_DAYS ? "expired" : null;
  }
  if (state.isUsedUp) return "used_up";
  if (state.expiresSoon) return "expiring";
  if (state.isLastLesson) return "last_lesson";
  return null;
}

const REASON_RANK: Record<PackageEndingReason, number> = {
  expired: 0,
  used_up: 1,
  expiring: 2,
  last_lesson: 3,
};

/**
 * Pacotes ativos acabando hoje: na ultima aula, vencendo em ate 7 dias (com
 * saldo), sem aulas (usado ate o fim, ainda valido) ou vencidos ha ate 7 dias,
 * sem pacote mais novo nas mesmas modalidades. Ordem: vencidos, sem aulas, os
 * que vencem primeiro, ultima aula.
 */
export function selectEndingPackages<T extends PackageLike>(
  packages: readonly T[],
  today: DateISO,
): PackageEnding<T>[] {
  const out: PackageEnding<T>[] = [];
  for (const pkg of packages) {
    if (pkg.status !== "active") continue;
    const reason = reasonOf(pkg, today);
    if (!reason) continue;
    const renewed = packages.some((other) => isNewer(other, pkg) && modalitiesOverlap(other.modalityIds, pkg.modalityIds));
    if (renewed) continue;
    const daysToExpire = pkg.expiresAt
      ? differenceInCalendarDays(parseISO(pkg.expiresAt), parseISO(today))
      : undefined;
    out.push({ pkg, reason, ...(daysToExpire !== undefined ? { daysToExpire } : {}) });
  }
  return out.sort(
    (a, b) =>
      REASON_RANK[a.reason] - REASON_RANK[b.reason] ||
      (a.daysToExpire ?? Number.MAX_SAFE_INTEGER) - (b.daysToExpire ?? Number.MAX_SAFE_INTEGER),
  );
}
