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

/**
 * Som do sino (12/11/2026): toca junto com o pulsar, uma vez por item novo
 * NESTE aparelho (as abas abertas dividem a lista, entao duas abas nao tocam o
 * mesmo item). Ao abrir o app o sino so pulsa: o som e para o que chega com o
 * app aberto (e o navegador nem deixa tocar antes do primeiro toque na pagina).
 */
export const BELL_SOUND_WARMUP_MS = 15_000;
const RUNG_STORAGE_KEY = "gestarahub:bell-rung";

/** Itens novos que ainda nao tocaram o sino. */
export function keysToRing(fresh: readonly string[], rung: readonly string[]): string[] {
  const known = new Set(rung);
  return fresh.filter((key) => !known.has(key));
}

/** Itens que ja tocaram neste aparelho (sem armazenamento, nenhum: no maximo toca de novo). */
export function readRungKeys(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RUNG_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === "string") : [];
  } catch {
    return [];
  }
}

export function rememberRungKeys(keys: readonly string[]): void {
  try {
    const merged = [...new Set([...readRungKeys(), ...keys])].slice(-MAX_BELL_SEEN_KEYS);
    window.localStorage.setItem(RUNG_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // aba anonima ou armazenamento cheio: segue sem lembrar
  }
}
