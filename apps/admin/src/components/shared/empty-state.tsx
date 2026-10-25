import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

/** Lista ou bloco sem nada: ícone, uma frase e, se couber, a ação que resolve. Dentro de um `ListContainer` ou de um cartão. */
export function EmptyState({ icon: Icon = Inbox, title, description, children }: { icon?: LucideIcon; title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {children ? <div className="pt-1">{children}</div> : null}
    </div>
  );
}
