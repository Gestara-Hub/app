import { Suspense } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { InstallAppPrompt } from "@/components/layout/install-app-prompt";
import { NewVersionNotice } from "@/features/releases";
import { AttachmentUploaderProvider } from "@/components/layout/attachment-uploader-provider";
import { NavigationTracker } from "@/components/layout/navigation-tracker";
import { getCurrentUser, getSessionGoogleOnly, getSessionTimeZone } from "@/features/auth/get-current-user";
import { SessionProvider } from "@/features/auth/session-provider";
import { SecurityPromptHost } from "@/features/auth/components/security-prompt-host";
import { ScheduleNoticeHost } from "@/features/turmas/components/schedule-notice-host";
import { getOrganizationTier } from "@/features/auth/get-subscription-tier";
import { organizationModelById } from "@/mocks/store";
import { firstAllowedRoute, isRouteInModel } from "@/components/layout/nav";
import { PATHNAME_HEADER } from "@/lib/request-path";
import { DiscoveryNextStepBar } from "@/features/onboarding/components/discovery-next-step-bar";
import { OnboardingTopBanner } from "@/features/onboarding/components/onboarding-top-banner";
import { SetupGuard } from "@/features/onboarding/components/setup-guard";
import { WhatsAppConfirmHost } from "@/features/communication/components/whatsapp-confirm-host";
import { PlanNoticeBanner } from "@/features/subscription/components/plan-notice-banner";
import { UrgentNoticesHost } from "@/features/dashboard/components/urgent-notices";
import { AnnouncementBanner } from "@/features/support/components/announcement-banner";
import { CrumbTracker } from "@/features/support/components/crumb-tracker";
import { HelpHost } from "@/features/support/components/help-host";
import { SupportHost } from "@/features/support/components/support-host";
import { UserPreferencesProvider } from "@/features/preferences";
import {
  VIEW_MODE_STORAGE_PREFIX,
  ViewModeProvider,
  type ListViewMode,
} from "@/components/shared/list";

// Imports direto dos arquivos (11/11/2026), nao dos barris das features: o
// layout e servidor, e cada barril importado aqui virava referencia de cliente
// com a feature inteira, no pacote de toda tela logada.
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
  // Guarda de modelo aqui, antes da pagina (11/11/2026): tela de outro modelo
  // aberta pelo endereco volta com redirecionamento HTTP. So o modelo: a
  // permissao fina fica no `requirePermission` de cada pagina (o professor abre
  // a ficha dos alunos dele sem ter "ver alunos", que e a permissao do menu).
  // `/appointments` e so o endereco antigo da Agenda (`/schedule`).
  const pathname = (await headers()).get(PATHNAME_HEADER)?.replace(/^\/appointments(?=\/|$)/, "/schedule");
  if (pathname && !isRouteInModel(pathname, model)) redirect(firstAllowedRoute(user, model));
  // Tier do plano GestaraHub: o do banco na conta real (achado 80); demonstracao, o cookie espelho.
  const tier = await getOrganizationTier(user);
  // Fuso do espaco: "hoje" e "agora" do navegador saem dele, nao do aparelho.
  const timeZone = await getSessionTimeZone(user);
  // Conta so do Google: o menu da conta nao mostra Seguranca.
  const googleOnly = await getSessionGoogleOnly(user);

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
    <SessionProvider user={user} model={model} tier={tier} timeZone={timeZone} googleOnly={googleOnly}>
      <UserPreferencesProvider>
        <AttachmentUploaderProvider>
        <ViewModeProvider initialModes={initialViewModes}>
          <SidebarProvider key={user.organizationId} defaultOpen={defaultOpen}>
            <AppSidebar />
            <NavigationTracker />
            <WhatsAppConfirmHost />
            <SupportHost />
            <CrumbTracker />
            <HelpHost />
            <SecurityPromptHost />
            <InstallAppPrompt />
            <NewVersionNotice />
            <ScheduleNoticeHost />
            {/* Gravacoes de uso ocultam todo texto daqui (dados de alunos): lib/analytics. */}
            <SidebarInset data-analytics-mask="" className="print:bg-white print:p-0">
              <AppTopbar />
              <AnnouncementBanner />
              <PlanNoticeBanner />
              <UrgentNoticesHost />
              <Suspense fallback={null}>
                <OnboardingTopBanner />
                <DiscoveryNextStepBar />
              </Suspense>
              <div className="mx-auto w-full max-w-7xl min-w-0 flex-1 p-4 md:p-6 print:p-0 print:max-w-none">
                <SetupGuard>{children}</SetupGuard>
              </div>
            </SidebarInset>
          </SidebarProvider>
        </ViewModeProvider>
        </AttachmentUploaderProvider>
      </UserPreferencesProvider>
    </SessionProvider>
  );
}
