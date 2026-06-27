import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/PagePlaceholder'

export const Route = createFileRoute('/_app/configuracoes')({
  component: () => (
    <PagePlaceholder
      titulo="Configuracoes"
      descricao="Dados da organizacao, unidade e horario de funcionamento."
    />
  ),
})
