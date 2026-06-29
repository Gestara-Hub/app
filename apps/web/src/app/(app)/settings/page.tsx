import { PageHeader } from "@/components/layout/page-header";
import { OrganizationSettingsCard } from "@/features/settings/components/organization-settings-card";
import { BusinessHoursCard } from "@/features/settings/components/business-hours-card";
import { ResetDataCard } from "@/features/system/components/reset-data-card";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Preferências da organização e da unidade."
      />
      <div className="grid max-w-4xl grid-cols-1 gap-4 lg:grid-cols-2">
        <OrganizationSettingsCard />
        <BusinessHoursCard />
        <div className="lg:col-span-2">
          <ResetDataCard />
        </div>
      </div>
    </>
  );
}
