/**
 * Normaliza texto para comparacao/busca: remove acentos, caixa baixa e tira
 * espacos nas pontas. Usado para dedupe/match case- e accent-insensitive.
 */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Nome com o tipo na frente, sem repetir: ("pacote", "10 aulas") ->
 * "pacote 10 aulas"; ("pacote", "Pacote 10 aulas") -> "Pacote 10 aulas".
 */
export function withKind(kind: string, name: string): string {
  const trimmed = name.trim();
  return normalizeText(trimmed).startsWith(`${normalizeText(kind)} `) ? trimmed : `${kind} ${trimmed}`;
}

/**
 * Caracteres como a pessoa ve: emoji conta 1 (no `length` do JS contava 2).
 * Usa o Intl.Segmenter quando ha; senao, conta os pontos de codigo.
 */
export function charCount(text: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return Array.from(new Intl.Segmenter("pt-BR", { granularity: "grapheme" }).segment(text)).length;
  }
  return [...text].length;
}
