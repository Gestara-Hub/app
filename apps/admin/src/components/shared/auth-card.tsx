import type { ReactNode } from "react";

/** Cartão das telas de entrada (mesma casca do app dos clientes): título, frase de apoio e o conteúdo. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-xl ring-1 ring-black/5 sm:p-8 dark:ring-white/5">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}
