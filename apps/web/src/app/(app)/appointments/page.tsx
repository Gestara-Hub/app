import { redirect } from "next/navigation";

// Agenda e Agendamentos foram unificados numa tela unica (/schedule, abas
// Calendário/Lista). Mantido como redirect para nao quebrar links antigos.
export default function AppointmentsPage() {
  redirect("/schedule");
}
