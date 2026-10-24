import { Badge } from "@/components/ui/badge";
import { planSituation, type PlanSituationKey, type SubscriptionJson } from "@/lib/space-plan";
import { cn } from "@/lib/utils";

const STYLE: Record<PlanSituationKey, string> = {
  free: "",
  active: "border-success/40 bg-success/10 text-success",
  courtesy: "border-info/40 bg-info/10 text-info",
  grace: "border-warning/40 bg-warning/10 text-warning",
  overdue: "border-destructive/40 bg-destructive/10 text-destructive",
  scheduled: "border-info/40 bg-info/10 text-info",
  reverted: "border-warning/40 bg-warning/10 text-warning",
};

export function PlanBadge({ subscription, today }: { subscription: SubscriptionJson | null; today: string }) {
  const situation = planSituation(subscription, today);
  return (
    <Badge variant="outline" className={cn("font-normal", STYLE[situation.key])} title={situation.detail}>
      {situation.label}
    </Badge>
  );
}
