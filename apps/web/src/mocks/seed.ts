import type { ServiceCategory, Service } from '@/types/service'
import type { RecordStatus } from '@/types/common'

const ORG = 'org-corte-nobre'
const TS = '2026-06-01T09:00:00.000Z'

function svc(
  id: string,
  name: string,
  category: ServiceCategory,
  durationMinutes: number,
  priceCents: number,
  status: RecordStatus = 'active',
): Service {
  return {
    id,
    organizationId: ORG,
    name,
    category,
    durationMinutes,
    priceCents,
    status,
    createdAt: TS,
    updatedAt: TS,
  }
}

// 12 servicos do cenario canonico Corte Nobre (docs/product/08).
export const servicesSeed: Service[] = [
  svc('svc-0001', 'Corte Masculino', 'hair', 30, 4500),
  svc('svc-0002', 'Corte Degrade', 'hair', 40, 5500),
  svc('svc-0003', 'Corte Infantil', 'hair', 30, 4000),
  svc('svc-0004', 'Pezinho / Acabamento', 'hair', 15, 2000),
  svc('svc-0005', 'Barba', 'beard', 30, 3500),
  svc('svc-0006', 'Barba Navalhada', 'beard', 40, 4500),
  svc('svc-0007', 'Pigmentacao de Barba', 'beard', 45, 6000),
  svc('svc-0008', 'Sobrancelha', 'care', 15, 2000),
  svc('svc-0009', 'Hidratacao Capilar', 'care', 30, 4000),
  svc('svc-0010', 'Relaxamento / Progressiva', 'care', 90, 12000),
  svc('svc-0011', 'Combo Corte + Barba', 'combo', 60, 7500),
  svc('svc-0012', 'Combo Completo (Corte + Barba + Sobrancelha)', 'combo', 75, 9000),
]
