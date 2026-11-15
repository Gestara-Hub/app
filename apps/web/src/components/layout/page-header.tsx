import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Acoes contextuais a direita (ex.: botao "Novo serviço"). */
  children?: ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-[min(100%,22rem)] flex-1 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ? (
        // Quebra para a linha de baixo quando o titulo + subtitulo ficariam apertados
        // (ex.: tablet ou janela estreita com varias acoes); no celular tambem pode quebrar entre si.
        <div className="flex max-w-full flex-wrap items-center gap-2 sm:shrink-0">
          {children}
        </div>
      ) : null}
    </div>
  );
}
