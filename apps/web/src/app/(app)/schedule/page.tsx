import { AgendaView } from "@/features/appointments/components/agenda-view";
import { requirePermission } from "@/features/auth/require-permission";

export default async function SchedulePage() {
  await requirePermission("schedule:view", "/schedule");
  return <AgendaView />;
}
