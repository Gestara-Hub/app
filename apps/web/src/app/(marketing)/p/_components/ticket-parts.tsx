import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pecas do visual de ingresso das paginas publicas do evento (inscricao e
 * ingresso, 12/11/2026): o cartao, o picote, o rotulo e a linha com icone.
 * A pagina usa fundo `bg-muted` solido: e a cor dos recortes do picote.
 */

export function TicketSheet({ children, className }: { children: React.ReactNode; className?: string }) {
  return <article className={cn("relative rounded-2xl bg-card text-card-foreground shadow-lg ring-1 ring-border", className)}>{children}</article>;
}

/** Linha tracejada com um recorte de cada lado (circulos da cor da pagina sobre a borda). */
export function Perforation() {
  return (
    <div className="relative" aria-hidden>
      <div className="mx-6 border-t-2 border-dashed border-border" />
      <span className="absolute -left-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-muted" />
      <span className="absolute -right-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-muted" />
    </div>
  );
}

export function TicketLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[11px] font-medium uppercase tracking-wider text-muted-foreground", className)}>{children}</p>;
}

export function TicketDetail({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <TicketLabel>{label}</TicketLabel>
        {children}
      </div>
    </div>
  );
}

/** Cabecalho: espaco em letras pequenas, o evento em destaque e a modalidade. */
export function TicketHeader({ organizationName, eventName, modalityName }: { organizationName: string; eventName: string; modalityName?: string }) {
  return (
    <header className="space-y-1 p-6">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{organizationName}</p>
      <h1 className="min-w-0 break-words text-xl font-semibold leading-tight text-foreground">{eventName}</h1>
      {modalityName ? <p className="text-sm text-muted-foreground">{modalityName}</p> : null}
    </header>
  );
}
