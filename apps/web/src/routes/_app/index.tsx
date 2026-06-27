import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/PagePlaceholder'

export const Route = createFileRoute('/_app/')({
  component: () => (
    <PagePlaceholder
      titulo="Dashboard"
      descricao="Resumo operacional do dia da Corte Nobre."
    />
  ),
})
