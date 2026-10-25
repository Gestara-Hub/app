/**
 * Passos que a pessoa deu antes de um erro ou relato (doc technical/21), como o
 * app dos clientes manda: `s` = segundos antes do envio, `k` = tipo, `v` = texto
 * fixo (caminho da tela com ids trocados por `:id`, ou o nome da ação).
 */
export type CrumbKind = "nav" | "action" | "action_error";

export interface Crumb {
  s: number;
  k: CrumbKind;
  v: string;
}

const KINDS: CrumbKind[] = ["nav", "action", "action_error"];

/** Lê passos do banco (jsonb) sem confiar na forma: o que não bate fica de fora. */
export function parseCrumbs(value: unknown): Crumb[] {
  if (!Array.isArray(value)) return [];
  const out: Crumb[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const { s, k, v } = item as Record<string, unknown>;
    if (typeof s === "number" && typeof v === "string" && KINDS.includes(k as CrumbKind)) out.push({ s, k: k as CrumbKind, v });
  }
  return out;
}

const KIND_LABEL: Record<CrumbKind, string> = { nav: "Abriu a tela", action: "Ação", action_error: "Ação com erro" };

export interface CrumbRow {
  /** "12 s antes", "agora"... em relação ao momento do envio (erro ou relato). */
  when: string;
  kind: CrumbKind;
  label: string;
  value: string;
}

function whenLabel(seconds: number): string {
  if (seconds < 1) return "agora";
  if (seconds < 60) return `${seconds} s antes`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} min antes` : `${Math.floor(minutes / 60)} h antes`;
}

/** Linhas para mostrar, do mais antigo para o mais novo (a ordem em que a pessoa fez). */
export function crumbRows(crumbs: Crumb[]): CrumbRow[] {
  return crumbs.map((c) => ({ when: whenLabel(c.s), kind: c.k, label: KIND_LABEL[c.k], value: c.v }));
}
