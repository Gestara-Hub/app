import { cn } from "@/lib/utils";
import { recordStatusLabel } from "@/lib/labels";
import type { RecordStatus } from "@gestarahub/contracts";

export function getRecordStatusClasses(isActive: boolean): string {
  return isActive
    ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : "border border-border/60 bg-muted/50 text-muted-foreground";
}

export interface RecordStatusBadgeProps {
  status: RecordStatus;
  className?: string;
}

export function RecordStatusBadge({ status, className }: RecordStatusBadgeProps) {
  const isActive = status === "active";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none shrink-0",
        getRecordStatusClasses(isActive),
        className,
      )}
    >
      {recordStatusLabel(status)}
    </span>
  );
}
