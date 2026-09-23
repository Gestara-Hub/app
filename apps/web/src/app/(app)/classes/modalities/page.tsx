import { ModalitiesView } from "@/features/turmas";
import { requirePermission } from "@/features/auth/require-permission";

export default async function ModalitiesPage() {
  await requirePermission("classes:manage", "/classes/modalities");
  return <ModalitiesView />;
}
