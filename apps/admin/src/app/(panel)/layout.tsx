import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { EnvStrip } from "@/components/layout/env-strip";
import { visibleNav } from "@/components/layout/nav";
import { UserMenu } from "@/components/layout/user-menu";
import { ADMIN_ROLE_LABEL, can } from "@/lib/permissions";
import { requireAdmin } from "@/lib/server/context";
import { getEnv } from "@/lib/server/env";
import { requestCounts } from "@/lib/server/privacy";
import { threadCounts } from "@/lib/server/support";

/** Casca do painel: so abre para quem passou por senha, segundo fator e tempo de sessao. */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdmin();
  // Numeros ao lado do menu: conversas esperando resposta e pedidos LGPD fora do prazo.
  const attention = can(admin.role, "support:view") ? (await threadCounts()).attention : 0;
  const privacy = can(admin.role, "lgpd:manage") ? (await requestCounts()).overdue : 0;
  const groups = visibleNav((permission) => can(admin.role, permission), { "/support": attention, "/privacy": privacy });
  return (
    <SidebarProvider>
      <AppSidebar groups={groups} />
      <SidebarInset>
        <EnvStrip env={getEnv().ADMIN_ENV_LABEL} />
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background/90 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <SidebarTrigger aria-label="Abrir ou fechar o menu" />
            <Separator orientation="vertical" className="h-5" />
            <span className="text-sm text-muted-foreground">Painel da plataforma</span>
          </div>
          <UserMenu name={admin.name} email={admin.email} roleLabel={ADMIN_ROLE_LABEL[admin.role]} />
        </header>
        <div className="mx-auto w-full max-w-7xl min-w-0 flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
