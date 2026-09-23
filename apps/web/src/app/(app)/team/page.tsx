import { ProfessionalsView } from "@/features/professionals/components/professionals-view";
import { requirePermission } from "@/features/auth/require-permission";

export default async function TeamPage() {
  await requirePermission("team:view", "/team");
  return <ProfessionalsView />;
}
