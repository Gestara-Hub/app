import {
  Outlet,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { authService } from '@/services/authService'

// Layout protegido do app (sidebar + topbar). Login fica fora deste layout.
export const Route = createFileRoute('/_app')({
  beforeLoad: () => {
    // Guarda mockada para navegacao no cliente.
    if (typeof window !== 'undefined' && !authService.getSession()) {
      throw redirect({ to: '/login' })
    }
  },
  component: AppLayout,
})

function AppLayout() {
  const router = useRouter()

  // Fallback para carga direta/hidratacao (SSR nao tem a sessao do localStorage).
  useEffect(() => {
    if (!authService.getSession()) {
      router.navigate({ to: '/login' })
    }
  }, [router])

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
