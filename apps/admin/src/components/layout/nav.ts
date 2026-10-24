import type { AdminPermission } from "@/lib/permissions";

/** Nomes dos icones (a lista de componentes fica no menu, que e de cliente). */
export type NavIconName = "LayoutDashboard" | "ShieldCheck" | "Users";

export interface NavItem {
  label: string;
  href: string;
  icon: NavIconName;
  permission: AdminPermission;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Menu do painel. Entra aqui so o que ja existe: cada fase acrescenta o seu
 * (Suporte, Espacos, Saude, Planos...). Ver docs/technical/26, secao 10.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operação",
    items: [{ label: "Início", href: "/", icon: "LayoutDashboard", permission: "dashboard:view" }],
  },
  {
    label: "Administração",
    items: [
      { label: "Equipe", href: "/team", icon: "Users", permission: "team:view" },
      { label: "Auditoria", href: "/audit", icon: "ShieldCheck", permission: "audit:view" },
    ],
  },
];

/** Grupos que a pessoa pode ver, sem os vazios. */
export function visibleNav(can: (permission: AdminPermission) => boolean): NavGroup[] {
  return NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => can(item.permission)) })).filter(
    (group) => group.items.length > 0,
  );
}
