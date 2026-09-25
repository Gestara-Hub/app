import {
  CalendarDays,
  CalendarRange,
  Contact,
  GraduationCap,
  Layers,
  LayoutDashboard,
  ScrollText,
  Settings,
  Shapes,
  Tag,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { can } from "@/lib/permissions";
import type { OperationalModel, Permission, User } from "@gestarahub/contracts";

export type NavSectionId =
  | "overview"
  | "daily_operations"
  | "financial"
  | "catalog";

export interface NavSectionMeta {
  id: NavSectionId;
  /** Rótulo da seção na sidebar (ausente para o topo/Dashboard sem cabeçalho). */
  label?: string;
  /** Alvo data-tour para destacar o bloco inteiro no Tour Guiado. */
  tourId?: string;
}

export const NAV_SECTIONS: NavSectionMeta[] = [
  { id: "overview" },
  {
    id: "daily_operations",
    label: "Operação Diária",
    tourId: "nav-group-operations",
  },
  {
    id: "financial",
    label: "Financeiro",
    tourId: "nav-group-financial",
  },
  {
    id: "catalog",
    label: "Cadastros",
    tourId: "nav-group-catalog",
  },
];

export interface NavItem {
  /** Rotulo visivel (PT acentuado). */
  label: string;
  /** Rota (em ingles, padrao do projeto). */
  href: string;
  icon: LucideIcon;
  /** Permissao minima para ver/acessar o item (RBAC). */
  permission: Permission;
  /** Secao visual na barra lateral. */
  section?: NavSectionId;
  /** Modelos operacionais em que o item aparece; ausente = compartilhado. */
  models?: OperationalModel[];
  /** Alvo do tour de onboarding (data-tour), quando destacado. */
  tourId?: string;
}

// Itens canonicos do app shell. `models` gata a visibilidade por tenant:
// scheduling (M1) ve Agenda/Serviços; classes (M3) ve Turmas/Calendário; os
// compartilhados (sem `models`) aparecem em todos.
export const MAIN_NAV: NavItem[] = [
  // Topo: Visão Geral
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    permission: "dashboard:view",
    section: "overview",
  },

  // Bloco 1: Operação Diária
  {
    label: "Calendário",
    href: "/classes/calendar",
    icon: CalendarRange,
    permission: "classes:view",
    section: "daily_operations",
    models: ["classes"],
  },
  {
    label: "Agenda",
    href: "/schedule",
    icon: CalendarDays,
    permission: "schedule:view",
    section: "daily_operations",
    models: ["scheduling"],
    tourId: "nav-agenda",
  },
  {
    label: "Turmas",
    href: "/classes",
    icon: GraduationCap,
    permission: "classes:view",
    section: "daily_operations",
    models: ["classes"],
    tourId: "nav-classes",
  },
  {
    label: "Alunos",
    href: "/clients",
    icon: Users,
    permission: "clients:view",
    section: "daily_operations",
    models: ["classes"],
  },
  {
    label: "Clientes",
    href: "/clients",
    icon: Users,
    permission: "clients:view",
    section: "daily_operations",
    models: ["scheduling", "delivery"],
  },

  // Bloco 2: Financeiro
  {
    label: "Mensalidades",
    href: "/classes/billing",
    icon: Wallet,
    permission: "billing:view",
    section: "financial",
    models: ["classes"],
  },

  // Bloco 3: Cadastros Estruturais
  {
    label: "Modalidades",
    href: "/classes/modalities",
    icon: Shapes,
    permission: "classes:manage",
    section: "catalog",
    models: ["classes"],
  },
  {
    label: "Planos",
    href: "/classes/plans",
    icon: Layers,
    permission: "billing:view",
    section: "catalog",
    models: ["classes"],
  },
  {
    label: "Serviços",
    href: "/services",
    icon: Tag,
    permission: "services:view",
    section: "catalog",
    models: ["scheduling"],
    tourId: "nav-services",
  },
  {
    label: "Equipe",
    href: "/team",
    icon: Contact,
    permission: "team:view",
    section: "catalog",
  },
];

// Itens administrativos (owner) ancorados no rodape, separados dos operacionais.
export const FOOTER_NAV: NavItem[] = [
  { label: "Usuários", href: "/users", icon: UserCog, permission: "users:view", tourId: "nav-users" },
  { label: "Auditoria", href: "/audit", icon: ScrollText, permission: "audit:view" },
  { label: "Configurações", href: "/settings", icon: Settings, permission: "settings:view", tourId: "nav-settings" },
];

/** Itens visiveis no modelo do tenant (undefined = compartilhado). */
export function navForModel(
  items: NavItem[],
  model: OperationalModel,
): NavItem[] {
  return items.filter((i) => !i.models || i.models.includes(model));
}

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Rota "nucleo" de cada modelo — destino do redirect pos-login/switch.
function coreRouteFor(model: OperationalModel): string {
  switch (model) {
    case "classes":
      return "/classes/calendar";
    case "delivery":
      return "/orders";
    case "scheduling":
    default:
      return "/schedule";
  }
}

/**
 * Rota "home" acessivel ao perfil DENTRO do modelo do tenant. Destino de redirect
 * pos-login e ao barrar rota — evita cair numa rota que nao existe no modelo
 * (ex.: /schedule num tenant de turmas).
 */
export function firstAllowedRoute(
  subject: Pick<User, "profile">,
  model: OperationalModel,
): string {
  if (can(subject, "dashboard:view")) return "/";
  const core = MAIN_NAV.find((i) => i.href === coreRouteFor(model));
  if (core && can(subject, core.permission)) return core.href;
  const item = navForModel(MAIN_NAV, model).find((i) =>
    can(subject, i.permission),
  );
  return item?.href ?? "/";
}

const ALL_NAV: NavItem[] = [...MAIN_NAV, ...FOOTER_NAV];

// Remove query/hash: o casamento de rota olha so o pathname.
function pathOnly(pathname: string): string {
  return pathname.split(/[?#]/)[0] || "/";
}

/**
 * Itens que casam com a rota no nivel MAIS especifico (href mais longo), igual
 * a sidebar: /classes/modalities e Modalidades, nao Turmas. Pode haver mais de
 * um (mesma rota com rotulo por modelo, ex.: Clientes/Alunos).
 */
function mostSpecificMatches(items: NavItem[], pathname: string): NavItem[] {
  const path = pathOnly(pathname);
  const matches = items.filter((i) => isNavItemActive(path, i.href));
  if (matches.length === 0) return [];
  const longest = Math.max(...matches.map((i) => i.href.length));
  return matches.filter((i) => i.href.length === longest);
}

/**
 * A rota existe no modelo do tenant? Rota fora de toda nav (ex.: detalhe sem
 * item proprio) herda do item-pai; sem nenhum item = compartilhada.
 */
export function isRouteInModel(
  pathname: string,
  model: OperationalModel,
): boolean {
  const matches = mostSpecificMatches(ALL_NAV, pathname);
  if (matches.length === 0) return true;
  return matches.some((i) => !i.models || i.models.includes(model));
}

/**
 * O usuario pode acessar a rota, considerando o modelo do tenant? Rota de outro
 * modelo e barrada; rota fora de toda nav (detalhes) e liberada (o gating fino
 * fica no requirePermission da page).
 */
export function canAccessRoute(
  subject: Pick<User, "profile">,
  pathname: string,
  model: OperationalModel,
): boolean {
  if (!isRouteInModel(pathname, model)) return false;
  const [item] = mostSpecificMatches(navForModel(ALL_NAV, model), pathname);
  return item ? can(subject, item.permission) : true;
}
