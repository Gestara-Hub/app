import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function AppointmentsPage() {
  return (
    <>
      <PageHeader
        title="Agendamentos"
        description="Lista de agendamentos da unidade."
      />
      <ComingSoon />
    </>
  );
}
