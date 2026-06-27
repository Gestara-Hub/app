import { Badge, Button, HStack, Table } from '@chakra-ui/react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDuration, formatPrice } from '@/lib/format'
import { CATEGORY_LABELS } from '@/types/service'
import type { Service } from '@/types/service'

interface Props {
  services: Service[]
  onEdit: (s: Service) => void
  onToggleStatus: (s: Service) => void
}

export function ServicesTable({ services, onEdit, onToggleStatus }: Props) {
  return (
    <Table.Root size="sm" variant="outline">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>Nome</Table.ColumnHeader>
          <Table.ColumnHeader>Categoria</Table.ColumnHeader>
          <Table.ColumnHeader>Duracao</Table.ColumnHeader>
          <Table.ColumnHeader>Preco</Table.ColumnHeader>
          <Table.ColumnHeader>Status</Table.ColumnHeader>
          <Table.ColumnHeader textAlign="end">Acoes</Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {services.map((s) => (
          <Table.Row key={s.id}>
            <Table.Cell fontWeight="medium" color="fg.default">
              {s.name}
            </Table.Cell>
            <Table.Cell>
              <Badge variant="subtle">{CATEGORY_LABELS[s.category]}</Badge>
            </Table.Cell>
            <Table.Cell>{formatDuration(s.durationMinutes)}</Table.Cell>
            <Table.Cell>{formatPrice(s.priceCents)}</Table.Cell>
            <Table.Cell>
              <StatusBadge status={s.status} />
            </Table.Cell>
            <Table.Cell textAlign="end">
              <HStack gap="2" justify="flex-end">
                <Button size="xs" variant="outline" onClick={() => onEdit(s)}>
                  Editar
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => onToggleStatus(s)}
                >
                  {s.status === 'active' ? 'Inativar' : 'Ativar'}
                </Button>
              </HStack>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  )
}
