import { requirePermission } from "@/features/auth/require-permission";
import { PlansView } from "@/features/turmas";

export default async function PlansPage() {
  await requirePermission("billing:view");
  return <PlansView />;
}
