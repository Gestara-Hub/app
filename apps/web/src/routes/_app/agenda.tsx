import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/PagePlaceholder'

export const Route = createFileRoute('/_app/agenda')({
  component: () => (
    <PagePlaceholder
      titulo="Agenda"
      descricao="Calendario de agendamentos (dia, semana e mes)."
    />
  ),
})
