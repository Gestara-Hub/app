import { ClientsView } from "@/features/clients/components/clients-view";
import { requirePermission } from "@/features/auth/require-permission";

export default async function ClientsPage() {
  await requirePermission("clients:view");
  return <ClientsView />;
}
