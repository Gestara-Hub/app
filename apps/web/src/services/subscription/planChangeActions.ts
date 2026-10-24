"use server";

import type { Subscription, SubscriptionInterval, SubscriptionTier } from "@gestarahub/contracts";
import { validationError } from "@gestarahub/core/api-error";
import { dateInSpace } from "@gestarahub/core/date";
import { notAfterAsaasToday, receiveInCash } from "@/lib/asaas";
import { serverPaymentsTestMode } from "@/lib/payments-test-mode";
import { isSubscriptionTier } from "@/lib/subscription";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runAction, type ActionResult } from "../server/action";
import { readOrganizationSubscription } from "../server/subscription";
import { listSubscriptionEvents, type SubscriptionEventView } from "../server/subscriptionEvents";
import {
  cancelScheduledPlanChange,
  confirmPlanChangePayment,
  previewPlanChange,
  startPlanChange,
  type PlanChangePaymentCheck,
  type PlanChangePreview,
  type PlanChangeStart,
} from "../server/subscriptionPlan";
import { requireTenant, type TenantContext } from "../server/tenant";
import type { PlanAuthor } from "../server/subscriptionEvents";
import { userActor } from "../server/systemAudit";

/**
 * Troca do Plano GestaraHub (doc product/13 §6): conta, troca, conferencia do
 * pagamento da diferenca e desmarcar a troca marcada. So quem gerencia o plano
 * (`subscription:manage`); o espaco vem da sessao.
 */

export interface PlanTarget {
  tier: SubscriptionTier;
  interval: SubscriptionInterval;
}

function checkTarget(target: PlanTarget): PlanTarget {
  if (!isSubscriptionTier(target?.tier) || (target.interval !== "monthly" && target.interval !== "yearly")) {
    throw validationError([{ field: "tier", message: "Plano inválido." }]);
  }
  return { tier: target.tier, interval: target.interval };
}

async function manager() {
  const ctx = await requireTenant();
  ctx.require("subscription:manage");
  return ctx;
}

/** Quem pediu (historico do plano e Auditoria). */
async function authorOf(ctx: TenantContext): Promise<PlanAuthor> {
  return { actor: await userActor(createSupabaseAdminClient(), ctx) };
}

export async function previewPlanChangeAction(target: PlanTarget): Promise<ActionResult<PlanChangePreview>> {
  return runAction(async () => {
    const ctx = await manager();
    return previewPlanChange(createSupabaseAdminClient(), ctx.organizationId, checkTarget(target));
  }, "previewPlanChangeAction");
}

export async function changePlanAction(target: PlanTarget): Promise<ActionResult<PlanChangeStart>> {
  return runAction(async () => {
    const ctx = await manager();
    return startPlanChange(createSupabaseAdminClient(), ctx.organizationId, checkTarget(target), await authorOf(ctx));
  }, "changePlanAction");
}

export async function checkPlanChangePaymentAction(paymentId: string): Promise<ActionResult<PlanChangePaymentCheck>> {
  return runAction(async () => {
    const ctx = await manager();
    return confirmPlanChangePayment(createSupabaseAdminClient(), ctx.organizationId, String(paymentId), {
      author: await authorOf(ctx),
    });
  }, "checkPlanChangePaymentAction");
}

/** Pix da diferenca pago no Asaas de testes. Fora do sandbox e recusado. */
export async function simulatePlanChangePaymentAction(paymentId: string): Promise<ActionResult<PlanChangePaymentCheck>> {
  return runAction(async () => {
    const ctx = await manager();
    if (!serverPaymentsTestMode()) {
      throw validationError([{ field: "paymentId", message: "A simulação só funciona no ambiente de testes." }]);
    }
    const admin = createSupabaseAdminClient();
    const subscription = await readOrganizationSubscription(admin, ctx.organizationId);
    const pending = subscription?.pendingChange;
    if (pending?.paymentId === paymentId && !paymentId.startsWith("pay_mock_")) {
      await receiveInCash(paymentId, notAfterAsaasToday(dateInSpace()), pending.amountCents / 100);
    }
    return confirmPlanChangePayment(admin, ctx.organizationId, String(paymentId), {
      simulated: true,
      author: await authorOf(ctx),
    });
  }, "simulatePlanChangePaymentAction");
}

export async function cancelScheduledPlanChangeAction(): Promise<ActionResult<Subscription>> {
  return runAction(async () => {
    const ctx = await manager();
    return cancelScheduledPlanChange(createSupabaseAdminClient(), ctx.organizationId, await authorOf(ctx));
  }, "cancelScheduledPlanChangeAction");
}

/** Historico do plano (doc technical/23), mais recente primeiro. So quem gerencia o plano. */
export async function listPlanHistoryAction(): Promise<ActionResult<SubscriptionEventView[]>> {
  return runAction(async () => {
    const ctx = await manager();
    return listSubscriptionEvents(createSupabaseAdminClient(), ctx.organizationId);
  }, "listPlanHistoryAction");
}
