"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { billingService } from "@/services/billing";
import { onlinePaymentsService } from "@/services/onlinePayments";
import type {
  FileAttachment,
  ChargeFilter,
  CreateExtraCharge,
  CreatePlan,
  DateISO,
  Id,
  OnlinePaymentMethod,
  PaymentMethod,
  PlanFilter,
  RefundChargeInput,
  UpdatePlan,
} from "@gestarahub/contracts";

/**
 * Toda mutation de cobranca mexe no dinheiro: invalida Cobrancas, o
 * Financeiro (le as cobrancas como entrada), a previa dos professores, os
 * pagamentos online e a Auditoria.
 */
function invalidateMoney(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.billing.all });
  qc.invalidateQueries({ queryKey: queryKeys.finance.all });
  qc.invalidateQueries({ queryKey: queryKeys.teacherPay.all });
  qc.invalidateQueries({ queryKey: queryKeys.onlinePayments.all });
  qc.invalidateQueries({ queryKey: queryKeys.audit.all });
  // Parcelas de curso: contagem de pagas e futuras na lista de matriculados.
  qc.invalidateQueries({ queryKey: ["classes", "enrollments"] });
  // Saldo em aberto e parcelas na ficha do aluno.
  qc.invalidateQueries({ queryKey: queryKeys.clients.summaries });
}

// --- Planos (Plans) -------------------------------------------------------
export function usePlans(filter?: PlanFilter) {
  return useQuery({
    queryKey: queryKeys.billing.plans(filter),
    queryFn: () => billingService.listPlans(filter),
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePlan) => billingService.createPlan(payload),
    // Pisca o item salvo na lista (lib/record-highlight).
    meta: { highlight: true },
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdatePlan }) =>
      billingService.updatePlan(id, payload),
    // Pisca o item salvo na lista (lib/record-highlight).
    meta: { highlight: true },
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useInactivatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) =>
      billingService.updatePlan(id, { status: "inactive" }),
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useReactivatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) =>
      billingService.updatePlan(id, { status: "active" }),
    onSuccess: () => invalidateMoney(qc),
  });
}

// --- Cobrancas (Charges) --------------------------------------------------
export function useCharges(filter?: ChargeFilter, enabled = true) {
  return useQuery({
    queryKey: queryKeys.billing.charges(filter),
    queryFn: () => billingService.listCharges(filter),
    enabled,
  });
}

/** Cobranca avulsa (a vista ou parcelada). */
export function useCreateExtraCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateExtraCharge) => billingService.createExtraCharge(payload),
    // Pisca a linha do aluno em Cobrancas (lib/record-highlight).
    meta: { highlight: (_data: unknown, vars: unknown) => (vars as CreateExtraCharge).studentId },
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useMarkChargePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      method,
      paidOn,
      receipts = [],
    }: {
      id: Id;
      method?: PaymentMethod;
      paidOn?: DateISO;
      /** Comprovantes ja enviados no diálogo (sobem ao serem escolhidos). */
      receipts?: FileAttachment[];
    }) =>
      billingService.markPaid(id, method, {
        paidOn,
        receipts: receipts.length > 0 ? receipts : undefined,
      }),
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useMarkChargePending() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => billingService.markPending(id),
    onSuccess: () => invalidateMoney(qc),
  });
}

/**
 * Devolucao recusada antes de mexer na cobranca (saldo, parceiro): a tela mostra
 * o motivo. `availableCents`/`neededCents` so quando falta saldo.
 */
export class RefundBlockedError extends Error {
  constructor(
    message: string,
    readonly availableCents?: number,
    readonly neededCents?: number,
  ) {
    super(message);
    this.name = "RefundBlockedError";
  }
}

/**
 * Devolver o pagamento (doc product/15, "Estorno de pagamento"). Pago online:
 * primeiro o estorno no parceiro (saldo conferido), depois o registro na
 * cobranca (reabrir ou encerrar). Fora do app: so o registro.
 */
export function useRefundCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RefundChargeInput & { online: boolean }) => {
      const { online, ...refund } = input;
      let needsConfirmation = false;
      if (online) {
        // O motivo vai junto: aparece no detalhe da cobranca estornada no Asaas.
        const result = await onlinePaymentsService.refundOnline(refund.chargeId, refund.reason);
        if (!result.ok) throw new RefundBlockedError(result.error, result.availableCents, result.neededCents);
        needsConfirmation = Boolean(result.needsConfirmation);
      }
      const charge = await billingService.refundCharge(refund);
      return { charge, needsConfirmation };
    },
    // Mesmo recusado no meio, o estorno pode ter sido pedido: rele tudo.
    onSettled: () => invalidateMoney(qc),
  });
}

export function useCancelCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: Id; reason?: string }) =>
      billingService.cancelCharge(id, reason),
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useRevertCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => billingService.reopenCharge(id),
    onSuccess: () => invalidateMoney(qc),
  });
}

// --- Cobranca online (Pix / link) ------------------------------------------
/** Dialogo "Cobrar online": aluno, telefone e os codigos gerados da cobranca. */
export function useOnlineCheckout(chargeId: Id | null) {
  return useQuery({
    queryKey: queryKeys.onlinePayments.forCharge(chargeId ?? ""),
    queryFn: () => onlinePaymentsService.getCheckout(chargeId!),
    enabled: Boolean(chargeId),
  });
}

/** Codigos em aberto do espaco: o "Lembrar no WhatsApp" manda o link junto. */
/** Estornos e contestacoes avisados pelo parceiro (sino, topo e modal; doc product/25). */
export function useDisputedOnlinePayments(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.onlinePayments.disputed,
    queryFn: () => onlinePaymentsService.listDisputed(),
    enabled,
  });
}

export function useAwaitingOnlinePayments(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.onlinePayments.awaiting,
    queryFn: () => onlinePaymentsService.listAwaiting(),
    enabled,
  });
}

export function useCreateOnlinePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      chargeId,
      method,
      passFeeToCustomer,
    }: {
      chargeId: Id;
      method: OnlinePaymentMethod;
      passFeeToCustomer?: boolean;
    }) => onlinePaymentsService.createForCharge(chargeId, method, passFeeToCustomer),
    onSuccess: () => invalidateMoney(qc),
  });
}

/** Demonstracao: marca o codigo e a cobranca como pagos. */
export function useSimulateOnlinePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (onlinePaymentId: Id) => onlinePaymentsService.simulatePaid(onlinePaymentId),
    onSuccess: () => invalidateMoney(qc),
  });
}

/** Autorizacoes ativas do Pix Automatico (aviso de limite na linha). */
export function useActiveRecurringAuthorizations(enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.onlinePayments.all, "recurring", "active"],
    queryFn: () => onlinePaymentsService.listActiveRecurring(),
    enabled,
  });
}

