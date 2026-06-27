import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { servicesService } from '@/services/servicesService'
import { queryKeys } from '@/lib/queryKeys'
import type { RecordStatus } from '@/types/common'
import type { ServiceFilter, ServiceInput } from '@/types/service'

export function useServices(filter?: ServiceFilter) {
  return useQuery({
    queryKey: queryKeys.services.list(filter),
    queryFn: () => servicesService.list(filter),
  })
}

export function useCreateService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ServiceInput) => servicesService.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.services.all }),
  })
}

export function useUpdateService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ServiceInput }) =>
      servicesService.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.services.all }),
  })
}

export function useSetServiceStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RecordStatus }) =>
      servicesService.setStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.services.all }),
  })
}
