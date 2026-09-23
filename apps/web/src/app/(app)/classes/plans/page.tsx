import { requirePermission } from "@/features/auth/require-permission";
import { PlansView } from "@/features/turmas";

export default async function PlansPage() {
  await requirePermission("billing:view", "/classes/plans");
  return <PlansView />;
}
