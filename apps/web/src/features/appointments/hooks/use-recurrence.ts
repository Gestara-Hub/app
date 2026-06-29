"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { recurrenceService } from "@/services/recurrenceService";
import type { CreateRecurrenceSeries } from "@/types";

export function useCreateSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRecurrenceSeries) => recurrenceService.create(payload),
    // Cria varias ocorrencias (agendamentos) — invalida a agenda.
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.appointments.all }),
  });
}
