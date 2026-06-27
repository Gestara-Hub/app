import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/PagePlaceholder'

export const Route = createFileRoute('/_app/clientes')({
  component: () => (
    <PagePlaceholder
      titulo="Clientes"
      descricao="Cadastro de clientes e historico de agendamentos."
    />
  ),
})
