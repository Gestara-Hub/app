import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/PagePlaceholder'

export const Route = createFileRoute('/_app/appointments')({
  component: () => (
    <PagePlaceholder
      title="Agendamentos"
      description="Lista de agendamentos com filtros, busca e status."
    />
  ),
})
