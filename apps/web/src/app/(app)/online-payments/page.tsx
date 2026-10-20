import { requirePermission } from "@/features/auth/require-permission";
import { OnlinePaymentsView } from "@/features/online-payments";

export default async function OnlinePaymentsPage() {
  await requirePermission("finance:view", "/online-payments");
  return <OnlinePaymentsView />;
}
