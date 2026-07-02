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
import { useCan } from "@/features/auth/session-provider";
import { FOOTER_NAV, MAIN_NAV, isNavItemActive, type NavItem } from "./nav";

function NavMenu({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const { isMobile, setOpenMobile } = useSidebar();

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={isNavItemActive(pathname, item.href)}
              tooltip={item.label}
            >
              <Link href={item.href} onClick={closeMobileSidebar}>
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
  const mainItems = MAIN_NAV.filter((item) => can(item.permission));
  const footerItems = FOOTER_NAV.filter((item) => can(item.permission));

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
            className="h-14 w-auto group-data-[collapsible=icon]:hidden dark:hidden"
            priority
          />
          <Image
            src={logoDarkImage}
            alt="GestaraHub"
            className="hidden h-14 w-auto dark:group-data-[collapsible=icon]:hidden dark:block"
            priority
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <NavMenu items={mainItems} pathname={pathname} />
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
