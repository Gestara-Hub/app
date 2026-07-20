import {
  CalendarDays,
  CalendarRange,
  Contact,
  GraduationCap,
  LayoutDashboard,
  ScrollText,
  Settings,
  Tag,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { can } from "@/lib/permissions";
import type { OperationalModel, Permission, User } from "@gestarahub/contracts";

export interface NavItem {
  /** Rotulo visivel (PT acentuado). */
  label: string;
  /** Rota (em ingles, padrao do projeto). */
  href: string;
  icon: LucideIcon;
  /** Permissao minima para ver/acessar o item (RBAC). */
  permission: Permission;
  /** Modelos operacionais em que o item aparece; ausente = compartilhado. */
  models?: OperationalModel[];
  /** Alvo do tour de onboarding (data-tour), quando destacado. */
  tourId?: string;
}

// Itens canonicos do app shell. `models` gata a visibilidade por tenant:
// scheduling (M1) ve Agenda/Serviços; classes (M3) ve Turmas/Calendário; os
// compartilhados (sem `models`) aparecem em todos.
export const MAIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, permission: "dashboard:view", models: ["scheduling"] },
  { label: "Clientes", href: "/clients", icon: Users, permission: "clients:view" },
  { label: "Equipe", href: "/team", icon: Contact, permission: "team:view" },
  { label: "Serviços", href: "/services", icon: Tag, permission: "services:view", models: ["scheduling"], tourId: "nav-services" },
  { label: "Agenda", href: "/schedule", icon: CalendarDays, permission: "schedule:view", models: ["scheduling"], tourId: "nav-agenda" },
  { label: "Turmas", href: "/classes", icon: GraduationCap, permission: "classes:view", models: ["classes"] },
  { label: "Calendário", href: "/classes/calendar", icon: CalendarRange, permission: "classes:view", models: ["classes"] },
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
  if (model === "scheduling" && can(subject, "dashboard:view")) return "/";
  const core = MAIN_NAV.find((i) => i.href === coreRouteFor(model));
  if (core && can(subject, core.permission)) return core.href;
  const item = navForModel(MAIN_NAV, model).find((i) =>
    can(subject, i.permission),
  );
  return item?.href ?? "/";
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
  const modelNav = navForModel([...MAIN_NAV, ...FOOTER_NAV], model);
  const item = modelNav.find((i) => isNavItemActive(pathname, i.href));
  if (item) return can(subject, item.permission);
  const otherModelItem = [...MAIN_NAV, ...FOOTER_NAV].find((i) =>
    isNavItemActive(pathname, i.href),
  );
  return otherModelItem ? false : true;
}
