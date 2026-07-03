"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { timeBlocksService } from "@/services/timeBlocksService";
import type {
  CreateTimeBlock,
  Id,
  TimeBlockFilter,
  UpdateTimeBlock,
} from "@gestarahub/contracts";

export function useTimeBlocks(filter?: TimeBlockFilter) {
  return useQuery({
    queryKey: queryKeys.timeBlocks.list(filter),
    queryFn: () => timeBlocksService.list(filter),
  });
}

export function useCreateTimeBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTimeBlock) => timeBlocksService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.timeBlocks.all }),
  });
}

export function useUpdateTimeBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdateTimeBlock }) =>
      timeBlocksService.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.timeBlocks.all }),
  });
}

export function useDeleteTimeBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => timeBlocksService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.timeBlocks.all }),
  });
}
