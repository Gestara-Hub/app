import { Badge } from '@chakra-ui/react'
import type { RecordStatus } from '@/types/common'

// Record status badge (active/inactive). Appointment status has its own badge.
export function StatusBadge({ status }: { status: RecordStatus }) {
  return (
    <Badge colorPalette={status === 'active' ? 'green' : 'gray'} variant="subtle">
      {status === 'active' ? 'Ativo' : 'Inativo'}
    </Badge>
  )
}
