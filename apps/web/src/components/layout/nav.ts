import {
  Award,
  CalendarDays,
  CalendarRange,
  Contact,
  FileSpreadsheet,
  GraduationCap,
  Layers,
  LayoutDashboard,
  MessageSquareText,
  QrCode,
  ScrollText,
  Settings,
  Shapes,
  Tag,
  Ticket,
  UserCog,
  Users,
  Wallet,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { can } from "@/lib/permissions";
import type {
  OperationalModel,
  PaidFeature,
  Permission,
  User,
} from "@gestarahub/contracts";

export type NavSectionId =
  | "overview"
  | "daily_operations"
  | "financial"
  | "catalog";

export type NavContext = "operations" | "management";

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
    label: "Controladoria & Finanças",
    tourId: "nav-group-financial",
  },
  {
    id: "catalog",
    label: "Estrutura do Negócio",
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
  /**
   * Recurso pago exigido (plano GestaraHub). Sem o recurso o item continua
   * visivel (se o perfil tem a permissao), com cadeado, e a rota abre o upsell
   * (FeatureLocked). Nao afeta isRouteInModel/canAccessRoute.
   */
  feature?: PaidFeature;
  /** Abas de contexto da barra lateral em que o item aparece (Dia a dia vs Gestão). */
  contexts?: NavContext[];
}

// Itens canonicos do app shell. `models` gata a visibilidade por tenant:
// scheduling (M1) ve Agenda/Serviços; classes (M3) ve Turmas/Calendário; os
// compartilhados (sem `models`) aparecem em todos.
// `contexts` define em qual aba do seletor da sidebar o item aparece ("operations" = Dia a dia; "management" = Gestão).
export const MAIN_NAV: NavItem[] = [
  // Topo: Visão Geral (visível em ambos os contextos)
  {
    label: "Painel",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard:view",
    section: "overview",
    contexts: ["operations", "management"],
  },

  // Bloco 1: Operação Diária (Contexto: Dia a dia)
  {
    label: "Calendário",
    href: "/classes/calendar",
    icon: CalendarRange,
    permission: "classes:view",
    section: "daily_operations",
    models: ["classes"],
    contexts: ["operations"],
  },
  {
    label: "Agenda",
    href: "/schedule",
    icon: CalendarDays,
    permission: "schedule:view",
    section: "daily_operations",
    models: ["scheduling"],
    tourId: "nav-agenda",
    contexts: ["operations"],
  },
  {
    label: "Turmas",
    href: "/classes",
    icon: GraduationCap,
    permission: "classes:view",
    section: "daily_operations",
    models: ["classes"],
    tourId: "nav-classes",
    contexts: ["operations"],
  },
  // Eventos e seminarios (doc product/29): modulo proprio, so no modelo de turmas.
  {
    label: "Eventos",
    href: "/events",
    icon: Ticket,
    permission: "events:view",
    section: "daily_operations",
    models: ["classes"],
    contexts: ["operations"],
  },
  {
    label: "Alunos",
    href: "/clients",
    icon: Users,
    permission: "clients:view",
    section: "daily_operations",
    models: ["classes"],
    contexts: ["operations"],
  },
  {
    label: "Clientes",
    href: "/clients",
    icon: Users,
    permission: "clients:view",
    section: "daily_operations",
    models: ["scheduling", "delivery"],
    contexts: ["operations"],
  },
  {
    label: "Comunicação",
    href: "/communication",
    icon: MessageSquareText,
    permission: "communication:view",
    section: "daily_operations",
    contexts: ["operations"],
  },
  {
    label: "Cobranças",
    href: "/classes/billing",
    icon: Wallet,
    permission: "billing:view",
    section: "daily_operations",
    models: ["classes"],
    contexts: ["operations"],
  },

  // Bloco 2: Financeiro (Contexto: Gestão)
  {
    label: "Financeiro",
    href: "/finance",
    icon: WalletCards,
    permission: "finance:view",
    section: "financial",
    models: ["classes"],
    contexts: ["management"],
  },
  {
    label: "Recebimentos online",
    href: "/online-payments",
    icon: QrCode,
    permission: "finance:view",
    section: "financial",
    feature: "online_payments",
    contexts: ["management"],
  },
  {
    label: "Relatórios",
    href: "/reports",
    icon: FileSpreadsheet,
    permission: "reports:view",
    section: "financial",
    contexts: ["management"],
  },

  // Bloco 3: Cadastros Estruturais (Contexto: Gestão)
  {
    label: "Modalidades",
    href: "/classes/modalities",
    icon: Shapes,
    permission: "classes:manage",
    section: "catalog",
    models: ["classes"],
    contexts: ["management"],
  },
  {
    label: "Planos e pacotes",
    href: "/classes/plans",
    icon: Layers,
    permission: "billing:view",
    section: "catalog",
    models: ["classes"],
    contexts: ["management"],
  },
  {
    label: "Certificados",
    href: "/certificates",
    icon: Award,
    permission: "classes:manage",
    section: "catalog",
    models: ["classes"],
    feature: "certificates",
    contexts: ["management"],
  },
  {
    label: "Serviços",
    href: "/services",
    icon: Tag,
    permission: "services:view",
    section: "catalog",
    models: ["scheduling"],
    tourId: "nav-services",
    contexts: ["management"],
  },
  {
    label: "Equipe",
    href: "/team",
    icon: Contact,
    permission: "team:view",
    section: "catalog",
    contexts: ["management"],
  },
];

// Itens administrativos (owner) ancorados no rodape.
export const FOOTER_NAV: NavItem[] = [
  {
    label: "Usuários",
    href: "/users",
    icon: UserCog,
    permission: "users:view",
    tourId: "nav-users",
    contexts: ["management"],
  },
  {
    label: "Auditoria",
    href: "/audit",
    icon: ScrollText,
    permission: "audit:view",
    contexts: ["management"],
  },
  {
    label: "Configurações",
    href: "/settings",
    icon: Settings,
    permission: "settings:view",
    tourId: "nav-settings",
    contexts: ["operations", "management"],
  },
];

export const ALL_NAV: NavItem[] = [...MAIN_NAV, ...FOOTER_NAV];

// Remove query/hash: o casamento de rota olha so o pathname.
function pathOnly(pathname: string): string {
  return pathname.split(/[?#]/)[0] || "/dashboard";
}

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
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

/** Retorna o item mais especifico da navegacao que casa com a rota e modelo informados. */
export function getActiveNavItem(
  pathname: string,
  model?: OperationalModel,
): NavItem | undefined {
  const items = model ? navForModel(ALL_NAV, model) : ALL_NAV;
  const matches = mostSpecificMatches(items, pathname);
  return matches[0];
}

/** Detecta se uma rota pertence exclusivamente a um dos contextos ("operations" | "management"). Retorna null se for compartilhada (ex: /dashboard, /settings). */
export function getContextForRoute(pathname: string): NavContext | null {
  const match = getActiveNavItem(pathname);
  if (!match || !match.contexts || match.contexts.length !== 1) {
    return null;
  }
  return match.contexts[0];
}

/** Itens visiveis no contexto ativo ("operations" = Dia a dia; "management" = Gestão). */
export function navForContext(
  items: NavItem[],
  context: NavContext,
): NavItem[] {
  return items.filter((i) => !i.contexts || i.contexts.includes(context));
}

/** Itens visiveis no modelo do tenant (undefined = compartilhado). */
export function navForModel(
  items: NavItem[],
  model: OperationalModel,
): NavItem[] {
  return items.filter((i) => !i.models || i.models.includes(model));
}

/**
 * O item esta travado pelo plano? (tem `feature` e o tenant nao tem o recurso).
 * A sidebar mostra o cadeado; a page decide o upsell no server.
 */
export function isNavItemLocked(
  item: Pick<NavItem, "feature">,
  hasFeature: (feature: PaidFeature) => boolean,
): boolean {
  return Boolean(item.feature) && !hasFeature(item.feature!);
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
  if (can(subject, "dashboard:view")) return "/dashboard";
  const core = MAIN_NAV.find((i) => i.href === coreRouteFor(model));
  if (core && can(subject, core.permission)) return core.href;
  const item = navForModel(MAIN_NAV, model).find((i) =>
    can(subject, i.permission),
  );
  return item?.href ?? "/dashboard";
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
