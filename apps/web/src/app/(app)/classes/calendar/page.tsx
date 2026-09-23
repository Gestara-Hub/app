import { requirePermission } from "@/features/auth/require-permission";
import { TurmasCalendarView } from "@/features/turmas";

export default async function ClassesCalendarPage() {
  await requirePermission("classes:view", "/classes/calendar");
  return <TurmasCalendarView />;
}
