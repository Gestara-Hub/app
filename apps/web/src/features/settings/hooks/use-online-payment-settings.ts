"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  onlinePaymentsService,
  type UpdateOnlinePaymentSettings,
} from "@/services/onlinePaymentsService";

/**
 * Grava a configuracao do pagamento online (fica em
 * `organization.settings.onlinePayments`). Ligar/desligar muda o que as
 * Mensalidades oferecem e o processamento do Pix Automatico.
 */
export function useUpdateOnlinePaymentSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateOnlinePaymentSettings) =>
      onlinePaymentsService.updateSettings(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.organization.detail });
      qc.invalidateQueries({ queryKey: queryKeys.onlinePayments.all });
      qc.invalidateQueries({ queryKey: queryKeys.billing.all });
      qc.invalidateQueries({ queryKey: queryKeys.finance.all });
      qc.invalidateQueries({ queryKey: queryKeys.audit.all });
    },
  });
}
