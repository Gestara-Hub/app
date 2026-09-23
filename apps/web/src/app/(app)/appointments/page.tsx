import { redirect } from "next/navigation";
import { requirePermission } from "@/features/auth/require-permission";

// Agenda e Agendamentos foram unificados numa tela unica (/schedule, abas
// Calendário/Lista). Mantido como redirect para nao quebrar links antigos.
export default async function AppointmentsPage() {
  await requirePermission("schedule:view", "/schedule");
  redirect("/schedule");
}
