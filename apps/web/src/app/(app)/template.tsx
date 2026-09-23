"use client";

import { usePathname } from "next/navigation";

/**
 * Entrada suave do conteudo a cada troca de pagina (layout, sidebar e topbar
 * ficam). O template do Next so remonta quando muda o 1o segmento
 * (/classes -> /classes/plans nao remontaria), entao a `key` e o pathname:
 * toda troca de caminho anima. Filtros/abas (search params) nao mudam o
 * pathname e nao animam. Quem prefere menos movimento nao ve o efeito.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div
      key={pathname}
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500 motion-safe:ease-out"
    >
      {children}
    </div>
  );
}
