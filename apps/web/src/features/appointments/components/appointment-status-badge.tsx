import { cn } from "@/lib/utils";
import { appointmentStatusLabel } from "@/lib/labels";
import type { AppointmentStatus } from "@gestarahub/contracts";

const BADGE: Record<AppointmentStatus, string> = {
  pending:
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400",
  confirmed:
    "border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-400",
  in_service:
    "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400",
  completed: "border-border bg-muted text-muted-foreground",
  canceled: "border-border bg-muted text-muted-foreground",
  no_show:
    "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-400",
};

export function AppointmentStatusBadge({
  status,
}: {
  status: AppointmentStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
        BADGE[status],
      )}
    >
      {appointmentStatusLabel(status)}
    </span>
  );
}
