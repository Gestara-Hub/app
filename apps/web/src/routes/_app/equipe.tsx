import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/PagePlaceholder'

export const Route = createFileRoute('/_app/equipe')({
  component: () => (
    <PagePlaceholder
      titulo="Equipe"
      descricao="Profissionais que realizam atendimentos."
    />
  ),
})
