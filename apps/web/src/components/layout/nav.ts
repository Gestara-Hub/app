import {
  CalendarClock,
  CalendarDays,
  LayoutDashboard,
  Scissors,
  Settings,
  Tag,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { can } from "@/lib/permissions";
import type { Permission, User } from "@/types";

export interface NavItem {
  /** Rotulo visivel (PT acentuado). */
  label: string;
  /** Rota (em ingles, padrao do projeto). */
  href: string;
  icon: LucideIcon;
  /** Permissao minima para ver/acessar o item (RBAC). */
  permission: Permission;
}

// Itens canonicos do app shell (ordem do doc frontend/04).
// "Equipe" e o rotulo de navegacao; "Profissional" e o termo de detalhe/agenda.
export const MAIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, permission: "dashboard:view" },
  { label: "Clientes", href: "/clients", icon: Users, permission: "clients:view" },
  { label: "Equipe", href: "/team", icon: Scissors, permission: "team:view" },
  { label: "Serviços", href: "/services", icon: Tag, permission: "services:view" },
  { label: "Agenda", href: "/schedule", icon: CalendarDays, permission: "schedule:view" },
  { label: "Agendamentos", href: "/appointments", icon: CalendarClock, permission: "appointments:view" },
];

// Itens administrativos (owner) ancorados no rodape, separados dos operacionais.
export const FOOTER_NAV: NavItem[] = [
  { label: "Usuários", href: "/users", icon: UserCog, permission: "users:view" },
  { label: "Configurações", href: "/settings", icon: Settings, permission: "settings:view" },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Rota "home" acessivel ao perfil. Usada como destino de redirect pos-login e
 * ao barrar rota — evita loop quando o usuario nao pode ver `/`. Prefere o
 * Dashboard (owner/gerente); senao a Agenda (nucleo operacional, todo perfil
 * tem `schedule:view`); senao a primeira rota permitida da nav.
 */
export function firstAllowedRoute(subject: Pick<User, "profile">): string {
  if (can(subject, "dashboard:view")) return "/";
  if (can(subject, "schedule:view")) return "/schedule";
  const item = MAIN_NAV.find((i) => can(subject, i.permission));
  return item?.href ?? "/schedule";
}

/**
 * O usuario pode acessar a rota? Casa o pathname com o item de nav
 * correspondente e checa sua permissao. Rotas fora da nav sao liberadas.
 */
export function canAccessRoute(
  subject: Pick<User, "profile">,
  pathname: string,
): boolean {
  const item = [...MAIN_NAV, ...FOOTER_NAV].find((i) =>
    isNavItemActive(pathname, i.href),
  );
  return item ? can(subject, item.permission) : true;
}
