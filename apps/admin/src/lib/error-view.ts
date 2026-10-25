/**
 * Como a tela do erro mostra a pilha e o contexto (doc technical/21): os quadros
 * do app primeiro, e o contexto com nomes em português, o que ajuda a achar a
 * causa antes do resto. Puro, para testar.
 */

/** Separa a primeira linha (o erro), os quadros do app e os do framework/Node. */
export function splitStack(stack: string): { head: string; appFrames: string[]; otherFrames: string[] } {
  const lines = stack.split("\n");
  const firstFrame = lines.findIndex((line) => line.trim().startsWith("at "));
  if (firstFrame === -1) return { head: stack, appFrames: [], otherFrames: [] };
  const head = lines.slice(0, firstFrame).join("\n");
  const appFrames: string[] = [];
  const otherFrames: string[] = [];
  for (const line of lines.slice(firstFrame)) {
    if (!line.trim()) continue;
    (/node_modules|node:internal|\(node:/.test(line) ? otherFrames : appFrames).push(line);
  }
  return { head, appFrames, otherFrames };
}

const KNOWN: [key: string, label: string][] = [
  ["route", "Tela"],
  ["profile", "Perfil"],
  ["plan", "Plano"],
  ["release", "Versão do app"],
  ["ms", "Tempo até o erro (ms)"],
  ["code", "Código do erro"],
];

export interface ContextRow {
  label: string;
  value: string;
  /** Chave original (para quem quer o nome técnico). */
  key: string;
}

const show = (value: unknown): string => (typeof value === "string" ? value : JSON.stringify(value));

/** Linhas do contexto: as conhecidas primeiro (com rótulo), a causa do banco aberta, e o resto como veio. */
export function contextRows(context: Record<string, unknown>): ContextRow[] {
  const rows: ContextRow[] = [];
  const used = new Set<string>();
  for (const [key, label] of KNOWN) {
    if (context[key] === undefined) continue;
    rows.push({ key, label, value: show(context[key]) });
    used.add(key);
  }
  const cause = context.cause;
  if (cause && typeof cause === "object" && !Array.isArray(cause)) {
    const { code, details, hint, ...rest } = cause as Record<string, unknown>;
    if (code !== undefined) rows.push({ key: "cause.code", label: "Código do banco", value: show(code) });
    if (details !== undefined) rows.push({ key: "cause.details", label: "Detalhe do banco", value: show(details) });
    if (hint !== undefined) rows.push({ key: "cause.hint", label: "Dica do banco", value: show(hint) });
    if (Object.keys(rest).length > 0) rows.push({ key: "cause", label: "Causa", value: show(rest) });
    used.add("cause");
  } else if (cause !== undefined) {
    rows.push({ key: "cause", label: "Causa", value: show(cause) });
    used.add("cause");
  }
  for (const [key, value] of Object.entries(context)) {
    if (!used.has(key)) rows.push({ key, label: key, value: show(value) });
  }
  return rows;
}
