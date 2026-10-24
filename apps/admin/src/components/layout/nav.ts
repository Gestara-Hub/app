import type { AdminPermission } from "@/lib/permissions";

/** Nomes dos icones (a lista de componentes fica no menu, que e de cliente). */
export type NavIconName = "Activity" | "Building2" | "CreditCard" | "LayoutDashboard" | "Scale" | "TrendingUp" | "LifeBuoy" | "Megaphone" | "ShieldCheck" | "Users";

export interface NavItem {
  label: string;
  href: string;
  icon: NavIconName;
  permission: AdminPermission;
  /** Contador ao lado do nome (ex.: conversas que esperam resposta). */
  badge?: number;
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
    items: [
      { label: "Início", href: "/", icon: "LayoutDashboard", permission: "dashboard:view" },
      { label: "Suporte", href: "/support", icon: "LifeBuoy", permission: "support:view" },
      { label: "Espaços", href: "/spaces", icon: "Building2", permission: "spaces:view" },
    ],
  },
  {
    label: "Plataforma",
    items: [
      { label: "Receita", href: "/revenue", icon: "TrendingUp", permission: "revenue:view" },
      { label: "Planos", href: "/plans", icon: "CreditCard", permission: "plans:view" },
      { label: "Comunicados", href: "/announcements", icon: "Megaphone", permission: "announcements:manage" },
      { label: "Saúde", href: "/health", icon: "Activity", permission: "health:view" },
    ],
  },
  {
    label: "Administração",
    items: [
      { label: "Equipe", href: "/team", icon: "Users", permission: "team:view" },
      { label: "LGPD", href: "/privacy", icon: "Scale", permission: "lgpd:manage" },
      { label: "Auditoria", href: "/audit", icon: "ShieldCheck", permission: "audit:view" },
    ],
  },
];

/** Grupos que a pessoa pode ver, sem os vazios. */
export function visibleNav(can: (permission: AdminPermission) => boolean, badges: Record<string, number> = {}): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(item.permission)).map((item) => ({ ...item, badge: badges[item.href] || undefined })),
  })).filter(
    (group) => group.items.length > 0,
  );
}
