import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/PagePlaceholder'

export const Route = createFileRoute('/_app/team/$id')({
  component: ProfessionalDetail,
})

function ProfessionalDetail() {
  const { id } = Route.useParams()
  return (
    <PagePlaceholder title="Detalhe do profissional" description={`Profissional: ${id}`} />
  )
}
