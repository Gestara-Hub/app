import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/PagePlaceholder'

export const Route = createFileRoute('/_app/schedule')({
  component: () => (
    <PagePlaceholder
      title="Agenda"
      description="Calendario de agendamentos (dia, semana e mes)."
    />
  ),
})
