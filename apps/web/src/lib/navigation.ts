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

// Navegacao canonica (ver docs/frontend/03 e 04). Rotulo "Equipe" na nav.
export const navPrincipal: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Agenda', to: '/agenda', icon: CalendarDays },
  { label: 'Agendamentos', to: '/agendamentos', icon: ClipboardList },
  { label: 'Clientes', to: '/clientes', icon: Users },
  { label: 'Equipe', to: '/equipe', icon: UserCog },
  { label: 'Servicos', to: '/servicos', icon: Scissors },
]

export const navRodape: NavItem[] = [
  { label: 'Configuracoes', to: '/configuracoes', icon: Settings },
]
