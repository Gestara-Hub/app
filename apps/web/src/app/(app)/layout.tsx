import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { SessionProvider } from "@/features/auth/session-provider";
import { organizationModelById } from "@/mocks/store";
import { OnboardingTopBanner } from "@/features/onboarding";
import {
  VIEW_MODE_STORAGE_PREFIX,
  ViewModeProvider,
  type ListViewMode,
} from "@/components/shared/list";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolve o usuario logado no server (defense-in-depth: o proxy ja barra sem
  // cookie) e injeta no client via SessionProvider.
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Modelo operacional do tenant do usuario (resolvido no server; sem flicker).
  const model = organizationModelById(user.organizationId) ?? "scheduling";

  // Estado de colapso da sidebar persistido pelo shadcn no cookie `sidebar_state`.
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  // Modos de visualizacao (lista vs card) persistidos em cookie para SSR sem flicker.
  const initialViewModes: Record<string, ListViewMode> = {};
  for (const c of cookieStore.getAll()) {
    if (
      c.name.startsWith(VIEW_MODE_STORAGE_PREFIX) &&
      (c.value === "list" || c.value === "grid")
    ) {
      const key = c.name.slice(VIEW_MODE_STORAGE_PREFIX.length);
      initialViewModes[key] = c.value;
    }
  }

  return (
    <SessionProvider user={user} model={model}>
      <ViewModeProvider initialModes={initialViewModes}>
        <SidebarProvider key={user.organizationId} defaultOpen={defaultOpen}>
          <AppSidebar />
          <SidebarInset>
            <AppTopbar />
            <Suspense fallback={null}>
              <OnboardingTopBanner />
            </Suspense>
            <div className="mx-auto w-full max-w-7xl min-w-0 flex-1 p-4 md:p-6">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </ViewModeProvider>
    </SessionProvider>
  );
}
