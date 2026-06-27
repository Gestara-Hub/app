import { useState } from 'react'
import { Button } from '@chakra-ui/react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { ServicesTable } from './ServicesTable'
import { ServiceFormDialog } from './ServiceFormDialog'
import {
  useCreateService,
  useServices,
  useSetServiceStatus,
  useUpdateService,
} from '../hooks/useServices'
import type { Service, ServiceInput } from '@/types/service'

export function ServicesPage() {
  const servicesQuery = useServices()
  const create = useCreateService()
  const update = useUpdateService()
  const setStatus = useSetServiceStatus()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(s: Service) {
    setEditing(s)
    setDialogOpen(true)
  }

  function save(input: ServiceInput) {
    if (editing) {
      update.mutate(
        { id: editing.id, input },
        { onSuccess: () => setDialogOpen(false) },
      )
    } else {
      create.mutate(input, { onSuccess: () => setDialogOpen(false) })
    }
  }

  function toggleStatus(s: Service) {
    setStatus.mutate({
      id: s.id,
      status: s.status === 'active' ? 'inactive' : 'active',
    })
  }

  const newButton = (
    <Button colorPalette="brand" size="sm" onClick={openCreate}>
      <Plus size={16} /> Novo servico
    </Button>
  )

  const services = servicesQuery.data ?? []

  return (
    <>
      <PageHeader
        title="Servicos"
        description="Servicos oferecidos pela Corte Nobre."
        action={newButton}
      />

      {servicesQuery.isLoading ? (
        <LoadingState label="Carregando servicos..." />
      ) : servicesQuery.isError ? (
        <ErrorState
          description="Nao foi possivel carregar os servicos."
          onRetry={() => servicesQuery.refetch()}
        />
      ) : services.length === 0 ? (
        <EmptyState
          title="Nenhum servico cadastrado"
          description="Comece cadastrando o primeiro servico."
          action={newButton}
        />
      ) : (
        <ServicesTable
          services={services}
          onEdit={openEdit}
          onToggleStatus={toggleStatus}
        />
      )}

      <ServiceFormDialog
        open={dialogOpen}
        service={editing}
        saving={create.isPending || update.isPending}
        onSave={save}
        onClose={() => setDialogOpen(false)}
      />
    </>
  )
}
