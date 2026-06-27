import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/PagePlaceholder'

export const Route = createFileRoute('/_app/agendamentos')({
  component: () => (
    <PagePlaceholder
      titulo="Agendamentos"
      descricao="Lista de agendamentos com filtros, busca e status."
    />
  ),
})
