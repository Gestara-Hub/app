"use client";

import { useState } from "react";

/**
 * Ultimo valor nao nulo. Para dialogs abertos por `open={x !== null}`: o `open`
 * usa o valor atual e o conteudo usa o retido, assim titulo, texto e botoes nao
 * somem nem trocam durante a animacao de saida.
 */
export function useRetainedValue<T>(value: T | null | undefined): T | null | undefined {
  const [retained, setRetained] = useState(value);
  if (value != null && value !== retained) setRetained(value);
  return value ?? retained;
}
