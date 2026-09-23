import { DashboardView } from "@/features/dashboard/components/dashboard-view";
import { requirePermission } from "@/features/auth/require-permission";

export default async function DashboardPage() {
  await requirePermission("dashboard:view", "/");
  return <DashboardView />;
}
