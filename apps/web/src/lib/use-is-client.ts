import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * `false` no servidor e na hidratacao, `true` depois no navegador. Para texto
 * que depende do relogio/fuso do usuario (ex.: "hoje"): renderiza so no client
 * e evita erro de hidratacao quando a data do servidor difere.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
