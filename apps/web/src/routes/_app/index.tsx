import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/PagePlaceholder'

export const Route = createFileRoute('/_app/')({
  component: () => (
    <PagePlaceholder
      title="Dashboard"
      description="Resumo operacional do dia da Corte Nobre."
    />
  ),
})
