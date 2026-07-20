import { requirePermission } from "@/features/auth/require-permission";
import { TurmasView } from "@/features/turmas";

export default async function ClassesPage() {
  await requirePermission("classes:view");
  return <TurmasView />;
}
