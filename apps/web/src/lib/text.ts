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

export function textIncludes(haystack: string, needle: string): boolean {
  return normalizeText(haystack).includes(normalizeText(needle));
}

/**
 * Busca de telefone pelos digitos: "(11) 97777-6603", "97777-6603" e
 * "977776603" encontram o mesmo numero, gravado so com digitos.
 */
export function phoneIncludes(phone: string | undefined, needle: string): boolean {
  const digits = needle.replace(/\D/g, "");
  if (!phone || digits.length < 3) return false;
  return phone.replace(/\D/g, "").includes(digits);
}

/** Sugestoes que ainda nao existem (sem diferenca de maiuscula ou acento): clicar numa ja existente so levaria ao erro de nome repetido. */
export function suggestionsNotTaken(suggestions: readonly string[], existingNames: readonly string[]): string[] {
  const taken = new Set(existingNames.map(normalizeText));
  return suggestions.filter((suggestion) => !taken.has(normalizeText(suggestion)));
}

/**
 * Singular da palavra de contagem ("alunos" -> "aluno", "mensagens" -> "mensagem",
 * "movimentações" -> "movimentação"; so a primeira palavra muda), para "Mostrando
 * 1–1 de 1 aluno" (achado 30 do teste de 23/10).
 */
export function singularLabel(pluralLabel: string): string {
  const [first = "", ...rest] = pluralLabel.split(" ");
  const singular = first.endsWith("ões")
    ? `${first.slice(0, -3)}ão`
    : first.endsWith("ns")
      ? `${first.slice(0, -2)}m`
      : first.endsWith("s")
        ? first.slice(0, -1)
        : first;
  return [singular, ...rest].join(" ");
}
