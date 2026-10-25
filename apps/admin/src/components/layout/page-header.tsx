import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Acoes contextuais a direita (ex.: botao "Novo serviço"). */
  children?: ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ? (
        // Quebra a linha no celular: as acoes nunca saem da tela.
        // No desktop as acoes ficam numa linha so; quem quebra e a descricao.
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{children}</div>
      ) : null}
    </div>
  );
}
