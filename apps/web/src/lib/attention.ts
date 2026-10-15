/**
 * Pulso de atencao "ate interagir": a parte pura do
 * `useAttentionUntilInteraction`, separada para teste.
 *
 * O pulso liga enquanto o destaque se aplica (`active`) e desliga quando o
 * usuario interage. A parada vale para a `key` em que aconteceu (ex.: o id do
 * passo do onboarding): uma chave nova pulsa de novo. Quando o destaque deixa de
 * se aplicar, a parada e esquecida, e a proxima ativacao pulsa outra vez.
 */
export type AttentionKey = string | number | null;

/** Chave em que o usuario interagiu, ou `null` se ainda nao interagiu. */
export type AttentionStop = { key: AttentionKey } | null;

/** Pulsa enquanto ativo e sem parada para a chave atual. */
export function isAttentionOn(
  active: boolean,
  stop: AttentionStop,
  key: AttentionKey,
): boolean {
  return active && (stop === null || stop.key !== key);
}

/** Inativo esquece a parada; ativo mantem a que existir. */
export function settleAttentionStop(active: boolean, stop: AttentionStop): AttentionStop {
  return active ? stop : null;
}

/** Parada apos uma interacao na chave atual (mesma referencia se ja parado). */
export function stopAttention(stop: AttentionStop, key: AttentionKey): AttentionStop {
  return stop !== null && stop.key === key ? stop : { key };
}
