import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import type {
  AttendanceStatus,
  CarriedLessons,
  ChargeStatus,
  DateISO,
  Id,
  PackageUsage,
  PackageUsageReason,
  StudentPackageStatus,
} from "@gestarahub/contracts";

/**
 * Pacote de aulas (doc 20, fase C): regras puras de saldo, validade, gasto de
 * aula na chamada e renovacao. O servico (mock hoje, API amanha) so guarda e
 * chama estas funcoes, para a regra nunca divergir entre telas.
 */

export const MAX_PACKAGE_LESSONS = 200;
export const MAX_PACKAGE_VALIDITY_DAYS = 730;
/** Aviso "vence em N dias" a partir de 7 dias. */
export const EXPIRING_SOON_DAYS = 7;

const toISO = (date: Date): DateISO => format(date, "yyyy-MM-dd");

/**
 * Ultimo dia em que as aulas valem: a compra + a validade em dias (comprado em
 * 01/10 com 30 dias vale ate 31/10). Sem validade, nao vence.
 */
export function packageExpiresAt(purchasedAt: DateISO, validityDays?: number): DateISO | undefined {
  if (!validityDays) return undefined;
  return toISO(addDays(parseISO(purchasedAt), validityDays));
}

/**
 * O que a chamada gasta (regra 4): presenca gasta uma aula; falta sem
 * justificativa gasta se o pacote mandar; falta justificada nunca gasta.
 * `null` = nao gasta.
 */
export function usageReasonFor(status: AttendanceStatus, absenceConsumes: boolean): PackageUsageReason | null {
  if (status === "present") return "present";
  if (status === "absent") return absenceConsumes ? "absent" : null;
  return null;
}

/** O pacote vale para a modalidade? Lista vazia = todas as modalidades. */
export function coversModality(modalityIds: readonly Id[], modalityId?: Id): boolean {
  if (modalityIds.length === 0) return true;
  return Boolean(modalityId && modalityIds.includes(modalityId));
}

/** Dois pacotes valem para alguma modalidade em comum? (vazio = todas). */
export function modalitiesOverlap(a: readonly Id[], b: readonly Id[]): boolean {
  if (a.length === 0 || b.length === 0) return true;
  return a.some((id) => b.includes(id));
}

export interface PackageBalance {
  lessonsTotal: number;
  lessonsUsed: number;
  expiresAt?: DateISO;
  status: StudentPackageStatus;
}

export interface PackageState {
  /** Aulas que ainda podem ser usadas (0 se renovado, cancelado ou vencido). */
  remaining: number;
  isExpired: boolean;
  isUsedUp: boolean;
  isLastLesson: boolean;
  expiresSoon: boolean;
  /** Dias ate o vencimento (0 = vence hoje; negativo = ja venceu). */
  daysToExpire?: number;
}

/** O pacote ja venceu em `date` (o ultimo dia valido ficou para tras). */
export function isPackageExpired(pkg: Pick<PackageBalance, "expiresAt">, date: DateISO): boolean {
  return Boolean(pkg.expiresAt && pkg.expiresAt < date);
}

/**
 * Saldo e avisos de hoje (regra 5): vencido perde o saldo; avisos na ultima
 * aula e quando vence em ate 7 dias.
 */
export function packageState(pkg: PackageBalance, today: DateISO): PackageState {
  const isExpired = isPackageExpired(pkg, today);
  const left = Math.max(0, pkg.lessonsTotal - pkg.lessonsUsed);
  const isActive = pkg.status === "active";
  const remaining = isActive && !isExpired ? left : 0;
  const daysToExpire = pkg.expiresAt ? differenceInCalendarDays(parseISO(pkg.expiresAt), parseISO(today)) : undefined;
  return {
    remaining,
    isExpired,
    isUsedUp: left === 0,
    isLastLesson: isActive && !isExpired && left === 1,
    expiresSoon:
      isActive && !isExpired && left > 0 && daysToExpire !== undefined && daysToExpire <= EXPIRING_SOON_DAYS,
    daysToExpire,
  };
}

/** Pode gastar uma aula numa aula de `date`: ativo, valido na data e com saldo. */
export function isUsableOn(pkg: PackageBalance, date: DateISO): boolean {
  return pkg.status === "active" && !isPackageExpired(pkg, date) && pkg.lessonsUsed < pkg.lessonsTotal;
}

type Candidate = PackageBalance & { modalityIds: readonly Id[]; purchasedAt: DateISO };

/**
 * Pacote que paga a aula: ativo, valido na data da aula, com saldo e que cobre
 * a modalidade; o que vence primeiro (sem validade por ultimo), depois o mais
 * antigo.
 */
export function pickPackageFor<T extends Candidate>(
  packages: readonly T[],
  session: { modalityId?: Id; date: DateISO },
): T | undefined {
  return packages
    .filter((p) => isUsableOn(p, session.date) && coversModality(p.modalityIds, session.modalityId))
    .sort(
      (a, b) =>
        (a.expiresAt ?? "9999-12-31").localeCompare(b.expiresAt ?? "9999-12-31") ||
        a.purchasedAt.localeCompare(b.purchasedAt),
    )[0];
}

/**
 * Renovacao (regra 6, revista em 18/10/2026): comprar de novo o MESMO pacote do
 * catalogo leva o saldo do que esta em uso para o novo. Pacote diferente, mesmo
 * da mesma modalidade (ex.: aulas em grupo e particulares), fica separado: os
 * dois valem e a aula usa o que vence primeiro (`pickPackageFor`). So pacotes
 * ativos, validos hoje e com saldo; vencido perde o saldo e usado ate o fim nao
 * tem o que levar.
 */
export function carryOverSources<T extends PackageBalance & { packageId: Id }>(
  packages: readonly T[],
  catalogPackageId: Id,
  today: DateISO,
): { sources: T[]; lessons: number } {
  const sources = packages.filter(
    (p) => p.packageId === catalogPackageId && packageState(p, today).remaining > 0,
  );
  const lessons = sources.reduce((sum, p) => sum + packageState(p, today).remaining, 0);
  return { sources, lessons };
}

// --- Valor de cada aula (repasse do professor, decisao 7 do doc 20) ----------

/**
 * Saldo do pacote em lotes: as aulas trazidas (por origem) vem primeiro, na
 * ordem guardada, e as compradas neste pacote depois. As aulas gastas ocupam
 * as posicoes na ordem da data da aula. Assim cada aula usada tem um pacote de
 * origem, e o valor dela e o da origem (preco / aulas compradas la).
 */
export interface PackageLots {
  id: Id;
  lessonsTotal: number;
  carriedOverLessons?: number;
  carriedFrom?: readonly CarriedLessons[];
  renewedFromId?: Id;
}

/** Aulas compradas neste pacote (sem as trazidas de outro). */
export function ownLessons(pkg: Pick<PackageLots, "lessonsTotal" | "carriedOverLessons">): number {
  return Math.max(0, pkg.lessonsTotal - (pkg.carriedOverLessons ?? 0));
}

/** Junta lotes da mesma origem, mantendo a ordem da primeira aparicao. */
export function mergeLots(lots: readonly CarriedLessons[]): CarriedLessons[] {
  const out: CarriedLessons[] = [];
  for (const lot of lots) {
    if (lot.lessons <= 0) continue;
    const same = out.find((l) => l.fromPackageId === lot.fromPackageId);
    if (same) same.lessons += lot.lessons;
    else out.push({ fromPackageId: lot.fromPackageId, lessons: lot.lessons });
  }
  return out;
}

/**
 * Lotes trazidos, acertados com `carriedOverLessons`: dado antigo sem
 * `carriedFrom` (ou com menos aulas) vale como trazido do `renewedFromId`;
 * lote a mais e cortado do fim.
 */
export function carriedLots(pkg: PackageLots): CarriedLessons[] {
  const carried = Math.max(0, pkg.carriedOverLessons ?? 0);
  if (carried === 0) return [];
  const lots = mergeLots(pkg.carriedFrom ?? []);
  let listed = lots.reduce((sum, l) => sum + l.lessons, 0);
  while (listed > carried && lots.length > 0) {
    const last = lots[lots.length - 1];
    const cut = Math.min(last.lessons, listed - carried);
    last.lessons -= cut;
    listed -= cut;
    if (last.lessons === 0) lots.pop();
  }
  if (listed < carried) {
    return mergeLots([...lots, { fromPackageId: pkg.renewedFromId ?? pkg.id, lessons: carried - listed }]);
  }
  return lots;
}

/** Origem de cada posicao do saldo (trazidas primeiro, depois as compradas). */
export function lessonOrigins(pkg: PackageLots): Id[] {
  const out: Id[] = [];
  for (const lot of carriedLots(pkg)) {
    for (let i = 0; i < lot.lessons; i++) out.push(lot.fromPackageId);
  }
  for (let i = 0; i < ownLessons(pkg); i++) out.push(pkg.id);
  return out;
}

/** Origem da aula na posicao (fora do saldo: o proprio pacote). */
export function lessonOriginAt(pkg: PackageLots, position: number): Id {
  return lessonOrigins(pkg)[position] ?? pkg.id;
}

/**
 * Lotes que saem do pacote na renovacao: as posicoes a partir das `used`
 * aulas gastas, agrupadas pela origem.
 */
export function leftoverLots(pkg: PackageLots, used: number): CarriedLessons[] {
  return mergeLots(lessonOrigins(pkg).slice(Math.max(0, used)).map((fromPackageId) => ({ fromPackageId, lessons: 1 })));
}

/** Cobranca do pacote, so o que o valor da aula precisa. */
export interface PackageChargeFact {
  status: ChargeStatus;
  amountCents: number;
}

const voidCharge = (c: PackageChargeFact) => c.status === "canceled" || c.status === "waived";

/** Preco que vale: soma das cobrancas do pacote, sem as canceladas. */
export function packagePriceCents(charges: readonly PackageChargeFact[]): number {
  return charges.filter((c) => !voidCharge(c)).reduce((sum, c) => sum + c.amountCents, 0);
}

/** Pago por inteiro: tem cobranca que vale e todas as que valem estao pagas. */
export function isPackageFullyPaid(charges: readonly PackageChargeFact[]): boolean {
  const valid = charges.filter((c) => !voidCharge(c));
  return valid.length > 0 && valid.every((c) => c.status === "paid");
}

/** Valor de cada aula: preco / aulas compradas, para baixo (a sobra fica com o espaco). */
export function packageUnitValueCents(priceCents: number, lessons: number): number {
  if (lessons <= 0 || priceCents <= 0) return 0;
  return Math.floor(priceCents / lessons);
}

export interface PackageForValue extends PackageLots {
  studentId: Id;
  usages: readonly PackageUsage[];
  charges: readonly PackageChargeFact[];
}

export interface ValuedPackageLesson extends PackageUsage {
  studentPackageId: Id;
  studentId: Id;
  /** Pacote que vendeu esta aula (o proprio ou o de onde ela foi trazida). */
  originPackageId: Id;
  valueCents: number;
  /** Pacote de origem pago por inteiro (so estas entram no repasse). */
  paid: boolean;
}

/**
 * Valor de cada aula usada. As aulas gastas de um pacote ocupam o saldo em
 * ordem de data (trazidas primeiro); cada uma vale o preco / aulas compradas
 * do pacote de origem e so conta como paga se a origem estiver paga por
 * inteiro. Origem desconhecida vale zero.
 */
export function valuePackageLessons(packages: readonly PackageForValue[]): ValuedPackageLesson[] {
  const byId = new Map(packages.map((p) => [p.id, p]));
  const unitCache = new Map<Id, { valueCents: number; paid: boolean }>();
  const unitOf = (id: Id) => {
    let unit = unitCache.get(id);
    if (!unit) {
      const origin = byId.get(id);
      unit = origin
        ? {
            valueCents: packageUnitValueCents(packagePriceCents(origin.charges), ownLessons(origin)),
            paid: isPackageFullyPaid(origin.charges),
          }
        : { valueCents: 0, paid: false };
      unitCache.set(id, unit);
    }
    return unit;
  };

  const out: ValuedPackageLesson[] = [];
  for (const pkg of packages) {
    const origins = lessonOrigins(pkg);
    const usages = [...pkg.usages].sort(
      (a, b) => a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId),
    );
    usages.forEach((usage, position) => {
      const originPackageId = origins[position] ?? pkg.id;
      out.push({
        ...usage,
        studentPackageId: pkg.id,
        studentId: pkg.studentId,
        originPackageId,
        ...unitOf(originPackageId),
      });
    });
  }
  return out;
}
