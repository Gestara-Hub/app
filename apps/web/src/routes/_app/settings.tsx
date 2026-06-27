import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/PagePlaceholder'

export const Route = createFileRoute('/_app/settings')({
  component: () => (
    <PagePlaceholder
      title="Configuracoes"
      description="Dados da organizacao, unidade e horario de funcionamento."
    />
  ),
})
