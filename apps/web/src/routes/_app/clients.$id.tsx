import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/PagePlaceholder'

export const Route = createFileRoute('/_app/clients/$id')({
  component: ClientDetail,
})

function ClientDetail() {
  const { id } = Route.useParams()
  return <PagePlaceholder title="Detalhe do cliente" description={`Cliente: ${id}`} />
}
