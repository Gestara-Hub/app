import { Badge } from "@/components/ui/badge";
import { recordStatusLabel } from "@/lib/labels";
import type { RecordStatus } from "@/types";

/** Badge de status de cadastro (ativo/inativo). Cor nunca e o unico sinal. */
export function ServiceStatusBadge({ status }: { status: RecordStatus }) {
  if (status === "active") {
    return (
      <Badge variant="outline" className="gap-1.5">
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: "var(--success)" }}
        />
        {recordStatusLabel(status)}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1.5 text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground" />
      {recordStatusLabel(status)}
    </Badge>
  );
}
