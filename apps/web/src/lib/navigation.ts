import {
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Scissors,
  Settings,
  UserCog,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
}

// Canonical navigation (see docs/frontend/03 and 04). Label "Equipe" in nav.
export const mainNav: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Agenda', to: '/schedule', icon: CalendarDays },
  { label: 'Agendamentos', to: '/appointments', icon: ClipboardList },
  { label: 'Clientes', to: '/clients', icon: Users },
  { label: 'Equipe', to: '/team', icon: UserCog },
  { label: 'Servicos', to: '/services', icon: Scissors },
]

export const footerNav: NavItem[] = [
  { label: 'Configuracoes', to: '/settings', icon: Settings },
]
