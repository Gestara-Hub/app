import { maskText } from "./log/mask";

/**
 * Rastro do que a pessoa fez antes de um erro ou relato (doc technical/21). O
 * navegador guarda, só na memória da aba, os últimos passos: telas abertas e
 * nomes das ações (com erro ou sem). Nunca texto digitado, valor de campo nem
 * nome de aluno: só o caminho da tela (com ids trocados por `:id`) e o nome
 * fixo da ação. Vai ao servidor quando há um erro com código, um erro do
 * navegador ou um relato de problema.
 */
export type CrumbKind = "nav" | "action" | "action_error";

/** Um passo, como viaja: `s` é quantos segundos ANTES do envio (sem depender do relógio). */
export interface Crumb {
  s: number;
  k: CrumbKind;
  v: string;
}

const KINDS: CrumbKind[] = ["nav", "action", "action_error"];

/** Quantos passos ficam na memória e quantos vão no envio. */
const KEEP = 30;
export const SEND_MAX = 20;
const MAX_VALUE = 120;
const MAX_AGE_SECONDS = 3600;

interface Stored {
  at: number;
  k: CrumbKind;
  v: string;
}

const buffer: Stored[] = [];

/** Caminho da tela sem query e com ids (uuid e números longos) trocados por `:id`. */
export function normalizePath(path: string): string {
  return path
    .split(/[?#]/)[0]
    .split("/")
    .map((part) => (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part) || /^\d{3,}$/.test(part) ? ":id" : part))
    .join("/");
}

/** Anota um passo (só no navegador). Telas repetidas em seguida contam uma vez. */
export function pushCrumb(kind: CrumbKind, value: string, now = Date.now()): void {
  if (typeof window === "undefined") return;
  const v = value.slice(0, MAX_VALUE);
  const last = buffer.at(-1);
  if (kind === "nav" && last?.k === "nav" && last.v === v) return;
  buffer.push({ at: now, k: kind, v });
  if (buffer.length > KEEP) buffer.splice(0, buffer.length - KEEP);
}

/** Os últimos passos, do mais antigo para o mais novo, com o tempo em segundos antes de agora. */
export function snapshotCrumbs(max = SEND_MAX, now = Date.now()): Crumb[] {
  return buffer.slice(-max).map((c) => ({ s: Math.max(0, Math.round((now - c.at) / 1000)), k: c.k, v: c.v }));
}

/** Só para testes. */
export function resetCrumbs(): void {
  buffer.length = 0;
}

/**
 * O que o servidor aceita do navegador: até 20 passos de tipos conhecidos, com
 * tempo e texto limitados e o texto mascarado (CPF, e-mail, chave). Nunca confia no que veio.
 */
export function sanitizeCrumbs(input: unknown): Crumb[] {
  if (!Array.isArray(input)) return [];
  const out: Crumb[] = [];
  for (const item of input.slice(-SEND_MAX)) {
    if (typeof item !== "object" || item === null) continue;
    const { s, k, v } = item as Record<string, unknown>;
    if (typeof s !== "number" || !Number.isFinite(s) || typeof v !== "string" || !KINDS.includes(k as CrumbKind)) continue;
    const value = maskText(v.trim().slice(0, MAX_VALUE));
    if (!value) continue;
    out.push({ s: Math.min(MAX_AGE_SECONDS, Math.max(0, Math.round(s))), k: k as CrumbKind, v: value });
  }
  return out;
}

type CrumbSender = (reference: string) => void;
let sender: CrumbSender | undefined;

/** Liga o envio dos passos de um erro com código (o app liga no `BrowserErrorReporter`). */
export function setCrumbSender(next: CrumbSender | undefined): void {
  sender = next;
}

/**
 * Chamado com o resultado de cada ação do servidor (no `unwrap`): anota o passo e,
 * se foi um erro inesperado (com código), manda os passos para completar a ocorrência.
 */
export function noteActionResult(result: { ok: boolean; event?: string; error?: { message?: string } }, reference?: string): void {
  if (typeof window === "undefined" || !result.event) return;
  if (result.ok) {
    pushCrumb("action", result.event);
    return;
  }
  pushCrumb("action_error", reference ? `${result.event} (${reference})` : result.event);
  if (reference) sender?.(reference);
}
