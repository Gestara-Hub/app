import Link from "next/link";
import { RelativeTime } from "@/components/shared/relative-time";
import { Badge } from "@/components/ui/badge";
import { TIMELINE_KIND_LABEL, type TimelineItem } from "@/lib/user-timeline";
import { cn } from "@/lib/utils";

const KIND_STYLE = {
  error: "border-destructive/40 text-destructive",
  action: "text-muted-foreground",
  thread: "border-primary/40 text-primary",
} as const;

/** A linha do tempo de uma pessoa: do mais novo para o mais antigo, com o tipo de cada item. */
export function TimelineList({ items, empty, compact = false }: { items: TimelineItem[]; empty: string; compact?: boolean }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y">
      {items.map((item, index) => (
        <li key={`${item.kind}-${item.at.toISOString()}-${index}`} className={cn("flex gap-2.5 text-sm first:pt-0 last:pb-0", compact ? "py-2" : "py-2.5")}>
          <Badge variant="outline" className={cn("mt-0.5 h-5 shrink-0 font-normal", KIND_STYLE[item.kind])}>
            {TIMELINE_KIND_LABEL[item.kind]}
          </Badge>
          <div className="min-w-0 flex-1 space-y-0.5">
            {item.href ? (
              <Link href={item.href} className="break-all underline underline-offset-2">
                {item.title}
              </Link>
            ) : (
              <p className="break-words">{item.title}</p>
            )}
            {item.detail ? <p className={cn("break-words text-xs", item.failed ? "text-destructive" : "text-muted-foreground")}>{item.detail}</p> : null}
            <p className="text-xs text-muted-foreground">
              <RelativeTime date={item.at} />
              {item.reference ? (
                <>
                  {" · código "}
                  <span className="select-all font-mono">{item.reference}</span>
                </>
              ) : null}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
