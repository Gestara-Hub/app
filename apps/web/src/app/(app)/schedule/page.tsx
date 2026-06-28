import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function SchedulePage() {
  return (
    <>
      <PageHeader
        title="Agenda"
        description="Agenda diária por profissional."
      />
      <ComingSoon note="A Agenda (react-big-calendar) será implementada adiante." />
    </>
  );
}
