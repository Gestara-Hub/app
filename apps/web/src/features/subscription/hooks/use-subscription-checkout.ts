"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SubscriptionInterval } from "@gestarahub/contracts";
import { queryKeys } from "@/lib/queryKeys";
import { subscriptionService } from "@/services/subscription/subscriptionService";
import type { CreateSubscriptionInput } from "@/services/subscription/actions";

export function useSubscriptionCheckout() {
  const qc = useQueryClient();

  const invalidateSubscription = () => {
    qc.invalidateQueries({ queryKey: queryKeys.subscription.detail });
    qc.invalidateQueries({ queryKey: queryKeys.organization.detail });
    qc.invalidateQueries({ queryKey: queryKeys.audit.all });
  };

  const createSession = useMutation({
    mutationFn: (input: Omit<CreateSubscriptionInput, "organizationId">) =>
      subscriptionService.createCheckoutSession(input),
    onSuccess: (res) => {
      if (res.success && res.status === "active") {
        invalidateSubscription();
      }
    },
  });

  const simulatePayment = useMutation({
    mutationFn: ({
      paymentId,
      tier,
      interval,
      subscriptionId,
    }: {
      paymentId: string;
      tier: "pro" | "scale";
      interval: SubscriptionInterval;
      subscriptionId?: string;
    }) =>
      subscriptionService.simulatePayment(
        paymentId,
        tier,
        interval,
        subscriptionId,
      ),
    onSuccess: (res) => {
      if (res.success) {
        invalidateSubscription();
      }
    },
  });

  // Pago: o servidor ja ativou o plano; a tela le de novo.
  const checkStatus = async (paymentId: string) => {
    const res = await subscriptionService.checkPaymentStatus(paymentId);
    if (res.isPaid) invalidateSubscription();
    return res;
  };

  return {
    createSession,
    simulatePayment,
    checkStatus,
    invalidateSubscription,
  };
}
