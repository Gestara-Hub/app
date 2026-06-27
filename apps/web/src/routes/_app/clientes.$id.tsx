import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/PagePlaceholder'

export const Route = createFileRoute('/_app/clientes/$id')({
  component: DetalheCliente,
})

function DetalheCliente() {
  const { id } = Route.useParams()
  return <PagePlaceholder titulo="Detalhe do cliente" descricao={`Cliente: ${id}`} />
}
