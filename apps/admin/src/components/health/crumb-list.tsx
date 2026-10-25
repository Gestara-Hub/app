import { Badge } from "@/components/ui/badge";
import { crumbRows, type Crumb } from "@/lib/crumbs-view";
import { cn } from "@/lib/utils";

/** Os passos antes de um erro ou relato, do mais antigo para o mais novo. */
export function CrumbList({ crumbs, empty }: { crumbs: Crumb[]; empty: string }) {
  if (crumbs.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ol className="space-y-1.5">
      {crumbRows(crumbs).map((row, index) => (
        <li key={`${row.value}-${index}`} className="flex items-start gap-2 text-xs">
          <span className="w-16 shrink-0 pt-0.5 text-right text-muted-foreground tabular-nums">{row.when}</span>
          <Badge variant="outline" className={cn("h-5 shrink-0 font-normal", row.kind === "action_error" && "border-destructive/40 text-destructive", row.kind === "nav" && "text-muted-foreground")}>
            {row.label}
          </Badge>
          <span className={cn("min-w-0 break-all font-mono", row.kind === "action_error" && "text-destructive")}>{row.value}</span>
        </li>
      ))}
    </ol>
  );
}
