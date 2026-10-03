import { requirePermission } from "@/features/auth/require-permission";
import { FinanceView } from "@/features/finance";

export default async function FinancePage() {
  await requirePermission("finance:view", "/finance");
  return <FinanceView />;
}
