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
