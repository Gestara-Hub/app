"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  onlinePaymentsService,
  type UpdateOnlinePaymentSettings,
} from "@/services/onlinePayments";
import {
  setupSubaccountAction,
  getSubaccountBalanceAction,
  requestSubaccountTransferAction,
  listSubaccountTransfersAction,
  listSubaccountReceiptsAction,
  type SetupSubaccountInput,
  type SubaccountReceiptsQuery,
} from "@/services/onlinePayments/actions";

/**
 * Grava a configuração do pagamento online (fica em
 * `organization.settings.onlinePayments`). Ligar/desligar muda o que as
 * Cobranças oferecem e o processamento do Pix Automático.
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

/**
 * Ativa a subconta de recebimentos da academia no gateway ativo (Asaas, etc.).
 */
export function useSetupGatewaySubaccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SetupSubaccountInput) => {
      const res = await setupSubaccountAction(input);
      if (res.success) {
        onlinePaymentsService.syncSubaccountApproved({
          gatewayAccountId: res.accountId,
          gatewayWalletId: res.walletId,
          gatewayStatus:
            (res.status as "approved" | "pending" | "rejected") ?? "approved",
        });
      }
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.organization.detail });
      qc.invalidateQueries({ queryKey: queryKeys.onlinePayments.all });
    },
  });
}

/**
 * Consulta o saldo financeiro da subconta. Sem atualizacao automatica: recarrega
 * pelo botao "Atualizar" da tela (ou ao abrir de novo).
 */
export function useSubaccountBalance(organizationId?: string) {
  return useQuery({
    queryKey: [...queryKeys.onlinePayments.all, "balance", organizationId],
    queryFn: () => getSubaccountBalanceAction(organizationId!),
    enabled: Boolean(organizationId),
  });
}

/**
 * Lista as transferências (saques) realizadas na subconta.
 */
export function useSubaccountTransfers(organizationId?: string) {
  return useQuery({
    queryKey: [...queryKeys.onlinePayments.all, "transfers", organizationId],
    queryFn: () => listSubaccountTransfersAction(organizationId!),
    enabled: Boolean(organizationId),
  });
}

/**
 * Lista os recebimentos online com detalhamento do split.
 */
export function useSubaccountReceipts(query: Omit<SubaccountReceiptsQuery, "organizationId"> & { organizationId?: string }) {
  return useQuery({
    queryKey: [...queryKeys.onlinePayments.all, "receipts", query],
    queryFn: () => listSubaccountReceiptsAction({ ...query, organizationId: query.organizationId! }),
    enabled: Boolean(query.organizationId),
    placeholderData: keepPreviousData,
  });
}

/**
 * Solicita uma transferência via Pix do saldo da subconta para a chave Pix do titular.
 */
export function useRequestSubaccountTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      organizationId: string;
      amountCents: number;
      pixKey: string;
      requestId: string;
    }) => requestSubaccountTransferAction(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.onlinePayments.all });
    },
  });
}
