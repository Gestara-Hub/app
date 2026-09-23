import { requirePermission } from "@/features/auth/require-permission";
import { BillingView } from "@/features/turmas";

export default async function BillingPage() {
  await requirePermission("billing:view", "/classes/billing");
  return <BillingView />;
}
