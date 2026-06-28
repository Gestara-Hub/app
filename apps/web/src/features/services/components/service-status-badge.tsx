import { Badge } from "@/components/ui/badge";
import type { StatusCadastro } from "@/types";

/** Badge de status de cadastro (ativo/inativo). Cor nunca e o unico sinal. */
export function ServiceStatusBadge({ status }: { status: StatusCadastro }) {
  if (status === "ativo") {
    return (
      <Badge variant="outline" className="gap-1.5">
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: "var(--success)" }}
        />
        Ativo
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1.5 text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground" />
      Inativo
    </Badge>
  );
}
