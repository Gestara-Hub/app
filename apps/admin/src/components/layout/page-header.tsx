import type { ReactNode } from "react";

/** Titulo da tela, uma linha de contexto e as acoes a direita. */
export function PageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight break-words">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground break-words">{description}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
