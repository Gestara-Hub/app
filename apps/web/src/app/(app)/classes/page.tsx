import { requirePermission } from "@/features/auth/require-permission";
import { ClassesScreen } from "./classes-screen";

export default async function ClassesPage() {
  await requirePermission("classes:view");
  return <ClassesScreen />;
}
