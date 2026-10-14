import type { ChargeKind, ChargeStatus, DateISO, MessageTrigger, StudentPackageStatus } from "@gestarahub/contracts";
import { formatCents, plural } from "@gestarahub/core/format";
import { packageState } from "@gestarahub/core/packages";
import { billingReminderTrigger } from "./message-meta";

/**
 * Valores das variaveis dos modelos novos (doc 20, fase D): o `{referencia}`
 * do lembrete de cobranca e o `{restante}` do pacote acabando. Puros, para a
 * mesma frase sair do Dashboard, de Cobrancas e dos testes.
 */

const ddmm = (iso: DateISO) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export interface ChargeForMessage {
  kind: ChargeKind;
  status: ChargeStatus;
  amountCents: number;
  dueDate: DateISO;
  description?: string;
  /** Turma do curso (quando a cobranca nao tem descricao). */
  className?: string;
  cycleIndex?: number;
  cycleTotal?: number;
}

/**
 * O que esta sendo cobrado, em palavras simples, para "Lembrete da {referencia}":
 * "cobrança Kimono", "parcela 2 de 4 do curso Confeitaria", "compra do pacote
 * 10 aulas". Todas femininas, porque o modelo escreve "da".
 */
export function chargeReference(charge: Omit<ChargeForMessage, "status" | "amountCents" | "dueDate">): string {
  if (charge.kind === "membership") return "mensalidade";
  if (charge.kind === "dropin") return "aula avulsa";
  const name = (charge.kind === "course" ? (charge.description ?? charge.className) : charge.description)?.trim();
  const noun = charge.kind === "course" ? "curso" : charge.kind === "package" ? "pacote" : "cobrança";
  const what = name ? `${noun} ${name}` : noun;
  const total = charge.cycleTotal ?? 1;
  if (total > 1) {
    const of = charge.kind === "extra" ? "da" : "do";
    return `parcela ${charge.cycleIndex ?? 1} de ${total} ${of} ${what}`;
  }
  if (charge.kind === "package") return `compra do ${what}`;
  if (charge.kind === "course") return `matrícula no ${what}`;
  return what;
}

/**
 * Lembrete de WhatsApp da cobranca em aberto: a mensalidade usa o lembrete
 * da situacao (antes, no dia, atraso, critico); avulsa, curso e pacote usam o
 * "Lembrete de cobrança". Aula avulsa nao tem lembrete (`null`).
 */
export function chargeReminder(
  charge: ChargeForMessage,
  today: DateISO,
): { trigger: MessageTrigger; values: Record<string, string> } | null {
  if (charge.kind === "dropin") return null;
  const values = { valor: formatCents(charge.amountCents), vencimento: ddmm(charge.dueDate) };
  if (charge.kind === "membership") return { trigger: billingReminderTrigger(charge, today), values };
  return { trigger: "charge_reminder", values: { ...values, referencia: chargeReference(charge) } };
}

export interface PackageForMessage {
  lessonsTotal: number;
  lessonsUsed: number;
  expiresAt?: DateISO;
  status: StudentPackageStatus;
}

/**
 * `{restante}` do "Pacote acabando": "resta 1 aula", "restam 3 aulas",
 * "vence em 5 dias e restam 2 aulas", "vence hoje e resta 1 aula",
 * "venceu em 12/10".
 */
export function packageRemainingText(pkg: PackageForMessage, today: DateISO): string {
  const state = packageState(pkg, today);
  if (state.isExpired && pkg.expiresAt) return `venceu em ${ddmm(pkg.expiresAt)}`;
  const left = Math.max(0, pkg.lessonsTotal - pkg.lessonsUsed);
  const lessons = left === 0 ? "as aulas acabaram" : left === 1 ? "resta 1 aula" : `restam ${plural(left, "aula", "aulas")}`;
  if (state.expiresSoon && state.daysToExpire !== undefined) {
    const days = state.daysToExpire;
    const expiry = days === 0 ? "vence hoje" : days === 1 ? "vence amanhã" : `vence em ${days} dias`;
    return `${expiry} e ${lessons}`;
  }
  return lessons;
}
