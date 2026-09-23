"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import iconImage from "@/assets/icon.png";
import logoLightImage from "@/assets/logo-light.png";
import logoDarkImage from "@/assets/logo-dark.png";
import { useCan, useModel } from "@/features/auth";
import {
  FOOTER_NAV,
  MAIN_NAV,
  isNavItemActive,
  navForModel,
  type NavItem,
} from "./nav";

function NavMenu({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const { isMobile, setOpenMobile } = useSidebar();

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  // Ativo = href que casa E e o mais especifico (mais longo), para um pai
  // (/classes) e um filho (/classes/calendar) nao ficarem ambos ativos.
  const activeHref = items
    .filter((i) => isNavItemActive(pathname, i.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={item.href === activeHref}
              tooltip={item.label}
            >
              <Link
                href={item.href}
                onClick={closeMobileSidebar}
                data-tour={item.tourId}
              >
                <Icon />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const can = useCan();
  const model = useModel();
  // Filtra por MODELO do tenant, depois por permissao (RBAC).
  const mainItems = navForModel(MAIN_NAV, model).filter((item) =>
    can(item.permission),
  );
  const footerItems = navForModel(FOOTER_NAV, model).filter((item) =>
    can(item.permission),
  );

  return (
    <Sidebar variant="inset" collapsible="icon">
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
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <div data-tour="sidebar-nav">
              <NavMenu items={mainItems} pathname={pathname} />
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {footerItems.length > 0 ? (
        <SidebarFooter>
          <NavMenu items={footerItems} pathname={pathname} />
        </SidebarFooter>
      ) : null}

      <SidebarRail />
    </Sidebar>
  );
}
