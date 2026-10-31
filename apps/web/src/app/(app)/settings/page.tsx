import { PageHeader } from "@/components/layout/page-header";
import { SettingsTabs } from "@/features/settings/components/settings-tabs";
import { requirePermission } from "@/features/auth/require-permission";

export default async function SettingsPage() {
  await requirePermission("settings:view", "/settings");
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Dados e regras do seu espaço."
      />
      <SettingsTabs />
    </>
  );
}
