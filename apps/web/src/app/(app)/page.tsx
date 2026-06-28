import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão geral da Corte Nobre — Matriz."
      />
      <ComingSoon note="Indicadores do dia chegam em breve." />
    </>
  );
}
