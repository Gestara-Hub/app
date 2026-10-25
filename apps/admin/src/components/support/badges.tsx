import { Badge } from "@/components/ui/badge";
import { SLA_LABEL, slaFor, type SlaState } from "@/lib/sla";
import { KIND_LABEL, STATUS_LABEL, type ThreadKind, type ThreadStatus } from "@/lib/support-types";
import { cn } from "@/lib/utils";

const SLA_STYLE: Record<SlaState, string> = {
  ok: "border-success/40 bg-success/10 text-success",
  last_day: "border-warning/40 bg-warning/10 text-warning",
  late: "border-destructive/40 bg-destructive/10 text-destructive",
};

/** Cor da meta de 2 dias uteis; so para quem espera resposta nossa. */
export function SlaBadge({ status, since, now }: { status: ThreadStatus; since: Date; now: Date }) {
  if (status !== "waiting_us") return null;
  const sla = slaFor(since, now);
  return (
    <Badge variant="outline" className={cn("font-normal", SLA_STYLE[sla.state])} title={`Prazo: ${sla.dueOn.split("-").reverse().join("/")}`}>
      {SLA_LABEL[sla.state]}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: ThreadStatus }) {
  return (
    <Badge variant={status === "waiting_us" ? "default" : "secondary"} className="font-normal">
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function UrgentBadge() {
  return (
    <Badge variant="destructive" className="font-normal">
      Urgente
    </Badge>
  );
}

/** Tipo da conversa; dúvida é o comum e não leva selo. */
export function KindBadge({ kind }: { kind: ThreadKind }) {
  if (kind === "question") return null;
  return (
    <Badge variant="outline" className={cn("font-normal", kind === "bug" ? "border-destructive/40 text-destructive" : "border-primary/40 text-primary")}>
      {KIND_LABEL[kind]}
    </Badge>
  );
}
