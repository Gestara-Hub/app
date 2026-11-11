/**
 * Pulsar do sino (doc product/25, "Níveis, urgência e novos lembretes"): o sino
 * pulsa ao abrir o app quando ha item de atencao ou urgencia NOVO desde a ultima
 * vez que foi aberto, e de novo quando chega um durante a sessao. Nada de
 * intervalo fixo. "Visto" e o conjunto de chaves que estava la na ultima abertura.
 */

/** Tamanho maximo do conjunto guardado nas preferencias. */
export const MAX_BELL_SEEN_KEYS = 300;

/** Chaves de atencao que ainda nao foram vistas. */
export function newAttentionKeys(current: readonly string[], seen: readonly string[] | undefined): string[] {
  const known = new Set(seen ?? []);
  return current.filter((key) => !known.has(key));
}

/** O que guardar ao abrir o sino: as chaves atuais (as mais recentes por ultimo), dentro do limite. */
export function seenKeysAfterOpening(current: readonly string[]): string[] {
  return [...new Set(current)].slice(-MAX_BELL_SEEN_KEYS);
}
