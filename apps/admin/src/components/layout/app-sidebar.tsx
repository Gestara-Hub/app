"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { APP_VERSION, APP_VERSION_LABEL } from "@/lib/release";
import { Brand } from "./brand";
import { Activity, Building2, CreditCard, LayoutDashboard, LifeBuoy, Megaphone, Scale, ShieldCheck, TrendingUp, Users, type LucideIcon } from "lucide-react";
import type { NavGroup, NavIconName } from "./nav";

/** Menu lateral. Os grupos ja chegam filtrados pelo papel da pessoa (servidor). */
export function AppSidebar({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <Brand />
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <Link href={item.href}>
                          <NavIcon name={item.icon} />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <p className="px-2 text-[11px] text-sidebar-foreground/50" title={`Versão ${APP_VERSION_LABEL}`}>
          Versão {APP_VERSION}
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

const ICONS: Record<NavIconName, LucideIcon> = { Activity, Building2, CreditCard, LayoutDashboard, LifeBuoy, Megaphone, Scale, ShieldCheck, TrendingUp, Users };

function NavIcon({ name }: { name: NavIconName }) {
  const Icon = ICONS[name];
  return <Icon />;
}
