import type { GuideStep } from "./help-search";

/**
 * Casamento do texto de um passo do guia com o que está na tela (puro e testado;
 * quem percorre o DOM é `features/support/guide-target.ts`). Sem acento,
 * maiúscula nem pontuação solta; `a|b` aceita mais de um rótulo.
 */
export function normalizeLabel(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[*:·•+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Rótulos aceitos de um passo, já normalizados. */
export function stepLabels(step: Pick<GuideStep, "label">): string[] {
  return step.label.split("|").map(normalizeLabel).filter(Boolean);
}

/**
 * Nota do texto do elemento para o passo: 3 igual, 2 começa com o rótulo, 1 tem o
 * rótulo como palavras inteiras, 0 não serve. Texto longo demais (um bloco da tela
 * que só contém o rótulo) não conta, para o destaque cair no elemento certo.
 */
export function matchScore(candidate: string, labels: string[]): number {
  const text = normalizeLabel(candidate);
  if (!text) return 0;
  let best = 0;
  for (const label of labels) {
    if (text === label) return 3;
    if (text.length > label.length + 40) continue;
    // Começa com o rótulo e a próxima letra não continua a palavra ("Pagas" casa com "Pagas 7" e com "Pagas7", não com "Pagamentos").
    if (text.startsWith(label) && !/^[a-z]/.test(text.slice(label.length))) best = Math.max(best, 2);
    else if (` ${text} `.includes(` ${label} `)) best = Math.max(best, 1);
  }
  return best;
}
