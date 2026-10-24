"use client";

import { Fragment, useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import iconImage from "@/assets/icon.png";
import logoLightImage from "@/assets/logo-light.png";
import logoDarkImage from "@/assets/logo-dark.png";
import { useCan, useHasFeature, useModel } from "@/features/auth";
import { SidebarSubscriptionCard } from "@/features/subscription";
import {
  FOOTER_NAV,
  MAIN_NAV,
  NAV_SECTIONS,
  getActiveNavItem,
  getContextForRoute,
  isNavItemActive,
  isNavItemLocked,
  navForContext,
  navForModel,
  type NavContext,
  type NavItem,
} from "./nav";

function NavMenu({
  items,
  activeHref,
}: {
  items: NavItem[];
  activeHref?: string;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const hasFeature = useHasFeature();

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = item.icon;
        // Recurso pago fora do plano: item visivel com cadeado (abre o upsell).
        const locked = isNavItemLocked(item, hasFeature);
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={item.href === activeHref}
              tooltip={locked ? `${item.label} (Plano Profissional)` : item.label}
            >
              <Link
                href={item.href}
                onClick={closeMobileSidebar}
                data-tour={item.tourId}
              >
                <Icon />
                <span>{item.label}</span>
                {locked ? (
                  <>
                    <Lock
                      aria-hidden
                      className="ml-auto size-3.5! text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden"
                    />
                    <span className="sr-only">(disponível no Plano Profissional)</span>
                  </>
                ) : null}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

const subscribeNoop = () => () => {};
function readSavedContext(): NavContext | null {
  try {
    const saved = localStorage.getItem("gestarahub:sidebar-context");
    return saved === "operations" || saved === "management" ? saved : null;
  } catch {
    return null;
  }
}

export function AppSidebar() {
  const pathname = usePathname();
  const can = useCan();
  const model = useModel();

  const [prevPathname, setPrevPathname] = useState(pathname);
  // Inicial igual no servidor e no cliente: so a rota decide. Ler o localStorage
  // no useState fazia o HTML do servidor e o do cliente divergirem (erro de
  // hidratacao). Sem rota de uma aba so, vale a aba salva, lida como "store
  // externo" (no servidor e na hidratacao: nenhuma).
  const [chosenContext, setContext] = useState<NavContext | null>(() => getContextForRoute(pathname));
  const savedContext = useSyncExternalStore(subscribeNoop, readSavedContext, () => null);
  const context: NavContext = chosenContext ?? savedContext ?? "operations";

  // Se a rota (pathname) mudou por navegação e pertence exclusivamente a outro contexto,
  // ajusta o contexto durante o render (padrão oficial do React para sincronização de props/rotas):
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    const routeContext = getContextForRoute(pathname);
    if (routeContext && routeContext !== context) {
      setContext(routeContext);
      try {
        localStorage.setItem("gestarahub:sidebar-context", routeContext);
      } catch {
        // ignore
      }
    }
  }

  // Se o tour guiado focar em seções de gestão, muda automaticamente de aba
  useEffect(() => {
    function handleTourTarget(e: Event) {
      const custom = e as CustomEvent<{ target?: string }>;
      const target = custom.detail?.target;
      if (target?.includes("financial") || target?.includes("catalog")) {
        setContext("management");
      } else if (target?.includes("operations") || target?.includes("context-switcher")) {
        setContext("operations");
      }
    }
    window.addEventListener("gestarahub:tour-target", handleTourTarget);
    return () => window.removeEventListener("gestarahub:tour-target", handleTourTarget);
  }, []);

  const handleContextChange = (next: NavContext) => {
    setContext(next);
    try {
      localStorage.setItem("gestarahub:sidebar-context", next);
    } catch {
      // ignore
    }
  };

  const routeContext = getContextForRoute(pathname);
  const activeRouteItem = getActiveNavItem(pathname, model);
  const isRouteInDifferentContext = Boolean(
    routeContext && routeContext !== context && activeRouteItem,
  );

  // Filtra por MODELO do tenant, permissao (RBAC) e CONTEXTO ativo (Dia a dia vs Gestão).
  const mainItems = navForContext(navForModel(MAIN_NAV, model), context).filter((item) =>
    can(item.permission),
  );
  const footerItems = navForContext(navForModel(FOOTER_NAV, model), context).filter((item) =>
    can(item.permission),
  );

  // Ativo = href que casa E e o mais especifico (mais longo), para um pai
  // (/classes) e um filho (/classes/calendar) nao ficarem ambos ativos.
  const allVisible = [...mainItems, ...footerItems];
  const activeHref = allVisible
    .filter((i) => isNavItemActive(pathname, i.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  // Agrupa os itens principais pelas secoes visuais (ignorando secoes vazias).
  const populatedSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: mainItems.filter(
      (item) => (item.section ?? "overview") === section.id,
    ),
  })).filter((section) => section.items.length > 0);

  return (
    <Sidebar variant="inset" collapsible="icon" className="print:hidden">
      <SidebarHeader>
        <div className="flex items-center justify-center gap-2 py-1">
          <Image
            src={iconImage}
            alt="GestaraHub"
            width={36}
            className="hidden rounded-sm group-data-[collapsible=icon]:block"
          />
          <Image
            src={logoLightImage}
            alt="GestaraHub"
            className="sidebar-logo-light h-14 w-auto group-data-[collapsible=icon]:hidden dark:hidden"
            priority
          />
          <Image
            src={logoDarkImage}
            alt="GestaraHub"
            className="sidebar-logo-dark hidden h-14 w-auto dark:group-data-[collapsible=icon]:hidden dark:block"
            priority
          />
        </div>

        {/* Seletor de Contexto no Topo (Opção 2: Dia a dia vs Gestão) */}
        <div className="px-3 pt-1 pb-1 group-data-[collapsible=icon]:hidden" data-tour="nav-context-switcher">
          <div className="grid grid-cols-2 rounded-lg bg-sidebar-accent/70 p-0.5 border border-sidebar-border text-xs">
            <button
              type="button"
              onClick={() => handleContextChange("operations")}
              aria-label={
                routeContext === "operations" && context !== "operations"
                  ? "Dia a dia (tela aberta nesta aba)"
                  : "Dia a dia"
              }
              className={cn(
                "relative flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-semibold transition-all cursor-pointer select-none",
                context === "operations"
                  ? "bg-background text-foreground shadow-2xs font-bold"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/40",
              )}
            >
              <span>Dia a dia</span>
              {routeContext === "operations" && context !== "operations" ? (
                <span className="relative flex size-2 shrink-0" title="A tela aberta no momento pertence a esta aba">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => handleContextChange("management")}
              aria-label={
                routeContext === "management" && context !== "management"
                  ? "Gestão (tela aberta nesta aba)"
                  : "Gestão"
              }
              className={cn(
                "relative flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-semibold transition-all cursor-pointer select-none",
                context === "management"
                  ? "bg-background text-foreground shadow-2xs font-bold"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/40",
              )}
            >
              <span>Gestão</span>
              {routeContext === "management" && context !== "management" ? (
                <span className="relative flex size-2 shrink-0" title="A tela aberta no momento pertence a esta aba">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {/* Alternador Compacto quando a sidebar está recolhida em ícone */}
        <div className="hidden group-data-[collapsible=icon]:flex justify-center py-1">
          <button
            type="button"
            onClick={() => handleContextChange(context === "operations" ? "management" : "operations")}
            title={
              isRouteInDifferentContext && activeRouteItem && routeContext
                ? `Tela aberta (${activeRouteItem.label}) pertence à aba ${routeContext === "operations" ? "Dia a dia" : "Gestão"}. Clique para alternar.`
                : context === "operations"
                  ? "Modo: Dia a dia (clique para alternar para Gestão)"
                  : "Modo: Gestão (clique para alternar para Dia a dia)"
            }
            className="relative flex size-7 items-center justify-center rounded-md border border-sidebar-border bg-sidebar-accent/80 text-[10px] font-bold text-sidebar-foreground hover:bg-sidebar-accent cursor-pointer transition-colors"
          >
            {context === "operations" ? "DIA" : "GES"}
            {isRouteInDifferentContext ? (
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-sidebar" />
            ) : null}
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent data-tour="sidebar-nav">
        {populatedSections.map((section, idx) => (
          <Fragment key={section.id}>
            {idx > 0 ? (
              <SidebarSeparator className="hidden group-data-[collapsible=icon]:block opacity-40" />
            ) : null}
            <SidebarGroup className="py-1" data-tour={section.tourId}>
              {section.label ? (
                <SidebarGroupLabel className="h-6 text-[10px] font-semibold tracking-wider uppercase text-sidebar-foreground/50">
                  {section.label}
                </SidebarGroupLabel>
              ) : null}
              <SidebarGroupContent>
                <NavMenu items={section.items} activeHref={activeHref} />
              </SidebarGroupContent>
            </SidebarGroup>
          </Fragment>
        ))}

        <div className="mt-auto p-2">
          {/* So quem pode contratar plano ve o cartao do plano (achado 71). */}
          {can("subscription:manage") ? <SidebarSubscriptionCard /> : null}
        </div>
      </SidebarContent>

      {footerItems.length > 0 ? (
        <SidebarFooter className="border-t border-sidebar-border pt-2">
          <NavMenu items={footerItems} activeHref={activeHref} />
        </SidebarFooter>
      ) : null}

      <SidebarRail />
    </Sidebar>
  );
}
