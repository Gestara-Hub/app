import { PageHeader } from "@/components/layout/page-header";
import { SettingsTabs } from "@/features/settings/components/settings-tabs";
import { requirePermission } from "@/features/auth/require-permission";

export default async function SettingsPage() {
  await requirePermission("settings:view");
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Preferências da organização e da unidade."
      />
      <SettingsTabs />
    </>
  );
}
