import { requirePermission } from "@/features/auth/require-permission";
import { PlansScreen } from "./plans-screen";

export default async function PlansPage() {
  await requirePermission("billing:view", "/classes/plans");
  return <PlansScreen />;
}
