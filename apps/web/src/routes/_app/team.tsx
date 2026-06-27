import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/PagePlaceholder'

export const Route = createFileRoute('/_app/team')({
  component: () => (
    <PagePlaceholder
      title="Equipe"
      description="Profissionais que realizam atendimentos."
    />
  ),
})
