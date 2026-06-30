import {
  CalendarClock,
  CalendarDays,
  LayoutDashboard,
  Scissors,
  Settings,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  /** Rotulo visivel (PT acentuado). */
  label: string;
  /** Rota (em ingles, padrao do projeto). */
  href: string;
  icon: LucideIcon;
}

// Itens canonicos do app shell (ordem do doc frontend/04).
// "Equipe" e o rotulo de navegacao; "Profissional" e o termo de detalhe/agenda.
export const MAIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Clientes", href: "/clients", icon: Users },
  { label: "Equipe", href: "/team", icon: Scissors },
  { label: "Serviços", href: "/services", icon: Tag },
  { label: "Agenda", href: "/schedule", icon: CalendarDays },
  { label: "Agendamentos", href: "/appointments", icon: CalendarClock },
];

// Configuracoes fica ancorado no rodape, separado dos modulos operacionais.
export const FOOTER_NAV: NavItem[] = [
  { label: "Configurações", href: "/settings", icon: Settings },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
