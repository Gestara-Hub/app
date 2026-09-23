import { AuditView } from "@/features/audit/components/audit-view";
import { requirePermission } from "@/features/auth/require-permission";

export default async function AuditPage() {
  await requirePermission("audit:view", "/audit");
  return <AuditView />;
}
