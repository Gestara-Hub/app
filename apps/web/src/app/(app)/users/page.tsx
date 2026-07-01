import { UsersView } from "@/features/users/components/users-view";
import { requirePermission } from "@/features/auth/require-permission";

export default async function UsersPage() {
  await requirePermission("users:view");
  return <UsersView />;
}
