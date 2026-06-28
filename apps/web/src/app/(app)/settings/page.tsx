import { PageHeader } from "@/components/layout/page-header";
import { ResetDataCard } from "@/features/system/components/reset-data-card";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Preferências da organização e da unidade."
      />
      <div className="max-w-2xl">
        <ResetDataCard />
      </div>
    </>
  );
}
