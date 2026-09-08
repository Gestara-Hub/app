import { ServicesView } from "@/features/services/components/services-view";
import { requirePermission } from "@/features/auth/require-permission";

export default async function ServicesPage() {
  await requirePermission("services:view");
  return <ServicesView />;
}
