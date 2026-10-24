import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { EnvStrip } from "@/components/layout/env-strip";
import { visibleNav } from "@/components/layout/nav";
import { UserMenu } from "@/components/layout/user-menu";
import { ADMIN_ROLE_LABEL, can } from "@/lib/permissions";
import { requireAdmin } from "@/lib/server/context";
import { getEnv } from "@/lib/server/env";

/** Casca do painel: so abre para quem passou por senha, segundo fator e tempo de sessao. */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdmin();
  const groups = visibleNav((permission) => can(admin.role, permission));
  return (
    <SidebarProvider>
      <AppSidebar groups={groups} />
      <SidebarInset>
        <EnvStrip env={getEnv().ADMIN_ENV_LABEL} />
        <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4">
          <SidebarTrigger aria-label="Abrir ou fechar o menu" />
          <UserMenu name={admin.name} email={admin.email} roleLabel={ADMIN_ROLE_LABEL[admin.role]} />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
