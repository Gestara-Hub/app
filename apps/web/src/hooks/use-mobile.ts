import * as React from "react"

const MOBILE_BREAKPOINT = 1024

/**
 * `true` quando a viewport esta abaixo de `lg` (celular e iPad em retrato).
 * Usa `useSyncExternalStore` (sem setState em effect) e e SSR-safe
 * (snapshot do servidor = false).
 */
export function useIsMobile() {
  const subscribe = React.useCallback((onChange: () => void) => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  )
}
