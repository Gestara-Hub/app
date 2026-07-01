import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { SessionProvider } from "@/features/auth/session-provider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolve o usuario logado no server (defense-in-depth: o proxy ja barra sem
  // cookie) e injeta no client via SessionProvider.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Estado de colapso da sidebar persistido pelo shadcn no cookie `sidebar_state`.
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SessionProvider user={user}>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarInset>
          <AppTopbar />
          <div className="flex-1 p-4 md:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </SessionProvider>
  );
}
