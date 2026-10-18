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
