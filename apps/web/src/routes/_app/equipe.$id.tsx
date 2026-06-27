import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/PagePlaceholder'

export const Route = createFileRoute('/_app/equipe/$id')({
  component: DetalheProfissional,
})

function DetalheProfissional() {
  const { id } = Route.useParams()
  return (
    <PagePlaceholder titulo="Detalhe do profissional" descricao={`Profissional: ${id}`} />
  )
}
