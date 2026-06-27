import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/PagePlaceholder'

export const Route = createFileRoute('/_app/clients')({
  component: () => (
    <PagePlaceholder
      title="Clientes"
      description="Cadastro de clientes e historico de agendamentos."
    />
  ),
})
