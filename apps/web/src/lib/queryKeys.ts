import type { ServiceFilter } from '@/types/service'

// Central TanStack Query key convention (see docs/frontend/02).
export const queryKeys = {
  services: {
    all: ['services'] as const,
    list: (filter?: ServiceFilter) =>
      ['services', 'list', filter ?? {}] as const,
    detail: (id: string) => ['services', 'detail', id] as const,
  },
}
