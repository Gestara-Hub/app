import {
  Outlet,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { authService } from '@/services/authService'

// Protected app layout (sidebar + topbar). Login lives outside this layout.
export const Route = createFileRoute('/_app')({
  beforeLoad: () => {
    // Mocked guard for client-side navigation.
    if (typeof window !== 'undefined' && !authService.getSession()) {
      throw redirect({ to: '/login' })
    }
  },
  component: AppLayout,
})

function AppLayout() {
  const router = useRouter()

  // Fallback for direct load/hydration (SSR has no localStorage session).
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
