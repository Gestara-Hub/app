import { z } from 'zod'
import type { DateTimeISO, Id, RecordStatus } from './common'

export const SERVICE_CATEGORIES = ['hair', 'beard', 'care', 'combo'] as const
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number]

// PT labels for display (structural value stays in English).
export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  hair: 'Cabelo',
  beard: 'Barba',
  care: 'Cuidados',
  combo: 'Combos',
}

// Entity contract (consistent with docs/product/04 and 08).
export interface Service {
  id: Id
  organizationId: Id
  name: string
  category: ServiceCategory
  durationMinutes: number
  priceCents: number
  description?: string
  status: RecordStatus
  createdAt: DateTimeISO
  updatedAt: DateTimeISO
}

// Fields sent to the service (create/update), already in contract format.
export interface ServiceInput {
  name: string
  category: ServiceCategory
  durationMinutes: number
  priceCents: number
  description?: string
  status: RecordStatus
}

export interface ServiceFilter {
  search?: string
  category?: ServiceCategory
  status?: RecordStatus
}

// --- Form validation (Zod) ---
// Schema for the FORM fields (numbers/price as string, as they come from inputs).
// Single source of validation; reusable in the mock service and future backend.
export const serviceFormSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do servico.'),
  category: z.enum(SERVICE_CATEGORIES),
  durationMinutes: z
    .string()
    .min(1, 'Informe a duracao.')
    .refine((v) => {
      const n = Number(v)
      return Number.isInteger(n) && n > 0
    }, 'Duracao deve ser um numero inteiro maior que zero.'),
  price: z
    .string()
    .min(1, 'Informe o preco.')
    .refine((v) => {
      const n = Number(v.replace(',', '.'))
      return Number.isFinite(n) && n >= 0
    }, 'Preco invalido (use 0 ou mais).'),
  description: z.string().trim().optional(),
  active: z.boolean(),
})

export type ServiceFormValues = z.infer<typeof serviceFormSchema>

const EMPTY_FORM: ServiceFormValues = {
  name: '',
  category: 'hair',
  durationMinutes: '',
  price: '',
  description: '',
  active: true,
}

// Service -> form values (or empty, for create).
export function serviceToFormValues(s?: Service | null): ServiceFormValues {
  if (!s) return { ...EMPTY_FORM }
  return {
    name: s.name,
    category: s.category,
    durationMinutes: String(s.durationMinutes),
    price: (s.priceCents / 100).toFixed(2),
    description: s.description ?? '',
    active: s.status === 'active',
  }
}

// Form values -> contract input (string -> number/cents).
export function serviceFormToInput(v: ServiceFormValues): ServiceInput {
  return {
    name: v.name.trim(),
    category: v.category,
    durationMinutes: Number(v.durationMinutes),
    priceCents: Math.round(Number(v.price.replace(',', '.')) * 100),
    description: v.description?.trim() || undefined,
    status: v.active ? 'active' : 'inactive',
  }
}
