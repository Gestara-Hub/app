import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/PagePlaceholder'

export const Route = createFileRoute('/_app/servicos')({
  component: () => (
    <PagePlaceholder
      titulo="Servicos"
      descricao="Servicos oferecidos: duracao, preco e categoria."
    />
  ),
})
