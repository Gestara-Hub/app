import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsTabs } from "@/features/settings/components/settings-tabs";
import { requirePermission } from "@/features/auth/require-permission";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  // Links antigos da aba Certificado passam a abrir a tela propria na sidebar.
  const { tab } = await searchParams;
  if (tab === "certificado") {
    redirect("/certificates");
  }
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
