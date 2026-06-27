import { db } from '@/mocks/db'
import { apiError, generateId, now, sleep } from '@/mocks/helpers'
import type { RecordStatus } from '@/types/common'
import type { Service, ServiceFilter, ServiceInput } from '@/types/service'

// Mocked API contract: swapping for a real backend = swap only this body,
// keeping the signatures. The UI never touches the store; it always goes
// through here (via hooks).
export const servicesService = {
  async list(filter?: ServiceFilter): Promise<Service[]> {
    await sleep()
    let items = [...db.services]
    if (filter?.search) {
      const q = filter.search.trim().toLowerCase()
      items = items.filter((s) => s.name.toLowerCase().includes(q))
    }
    if (filter?.category) {
      items = items.filter((s) => s.category === filter.category)
    }
    if (filter?.status) {
      items = items.filter((s) => s.status === filter.status)
    }
    return items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  },

  async getById(id: string): Promise<Service> {
    await sleep()
    const s = db.services.find((x) => x.id === id)
    if (!s) throw apiError('NOT_FOUND', 'Servico nao encontrado.')
    return s
  },

  async create(input: ServiceInput): Promise<Service> {
    await sleep()
    const ts = now()
    const created: Service = {
      id: generateId('svc'),
      organizationId: 'org-corte-nobre',
      ...input,
      createdAt: ts,
      updatedAt: ts,
    }
    db.services.push(created)
    return created
  },

  async update(id: string, input: ServiceInput): Promise<Service> {
    await sleep()
    const idx = db.services.findIndex((x) => x.id === id)
    if (idx === -1) throw apiError('NOT_FOUND', 'Servico nao encontrado.')
    const updated: Service = {
      ...db.services[idx],
      ...input,
      updatedAt: now(),
    }
    db.services[idx] = updated
    return updated
  },

  async setStatus(id: string, status: RecordStatus): Promise<Service> {
    await sleep()
    const idx = db.services.findIndex((x) => x.id === id)
    if (idx === -1) throw apiError('NOT_FOUND', 'Servico nao encontrado.')
    const updated: Service = {
      ...db.services[idx],
      status,
      updatedAt: now(),
    }
    db.services[idx] = updated
    return updated
  },
}
