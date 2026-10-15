"use client";

import { useCallback, useMemo, useState } from "react";
import {
  isAttentionOn,
  settleAttentionStop,
  stopAttention,
  type AttentionKey,
  type AttentionStop,
} from "./attention";

/**
 * Pulso continuo ate o usuario interagir (doc 08, pulsos de atencao).
 *
 * - `attention`: se o pulso esta ligado agora (use com as classes
 *   `motion-safe:animate-attention-*-infinite`).
 * - `stop`: desliga o pulso (ex.: `onClick` de um CTA).
 * - `handlers`: para secoes destacadas; qualquer toque ou foco dentro desliga.
 *
 * `key` rearma o pulso quando muda (ex.: outro passo ou nova chegada). Quando
 * `active` fica falso a parada e esquecida e a proxima ativacao pulsa de novo.
 */
export function useAttentionUntilInteraction(active: boolean, key: AttentionKey = null) {
  const [stop, setStop] = useState<AttentionStop>(null);
  const settled = settleAttentionStop(active, stop);
  if (settled !== stop) setStop(settled);
  const attention = isAttentionOn(active, settled, key);

  const stopNow = useCallback(() => {
    if (!attention) return;
    setStop((prev) => stopAttention(prev, key));
  }, [attention, key]);

  const handlers = useMemo(
    () => ({ onPointerDownCapture: stopNow, onFocusCapture: stopNow }),
    [stopNow],
  );

  return { attention, stop: stopNow, handlers };
}
