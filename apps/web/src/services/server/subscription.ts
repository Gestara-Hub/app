import type { SupabaseClient } from "@supabase/supabase-js";
import type { Subscription } from "@gestarahub/contracts";
import { forbiddenError } from "@gestarahub/core/api-error";
import { addPlanCycle } from "@gestarahub/core/subscription-plan";
import { SUBSCRIPTION_PRICES } from "@/config/subscription";
import { getPayment, getSubscription } from "@/lib/asaas";
import { subscriptionTierLabel } from "@/lib/labels";
import { decodeSubscriptionReference } from "@/lib/subscription";
import { recordSubscriptionEvent, systemAuthor, type PlanAuthor } from "./subscriptionEvents";

/**
 * Plano GestaraHub no banco. Modulo so do servidor, sem "use server": o plano
 * pago e gravado aqui depois de conferir o pagamento no Asaas, nunca pelo que
 * o navegador manda (achado 66 do teste de 23/10). O espaco nao grava a coluna
 * `subscription` (world/tables, SERVER_WRITTEN).
 */

const PAID_STATUSES = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];

export async function readOrganizationSubscription(
  admin: SupabaseClient,
  organizationId: string,
): Promise<Subscription | undefined> {
  const { data, error } = await admin.from("organizations").select("subscription").eq("id", organizationId).maybeSingle();
  if (error) throw error;
  return (data?.subscription as Subscription | null) ?? undefined;
}

export async function writeOrganizationSubscription(
  admin: SupabaseClient,
  organizationId: string,
  subscription: Subscription,
): Promise<void> {
  const { error } = await admin.from("organizations").update({ subscription }).eq("id", organizationId);
  if (error) throw error;
}

export interface SubscriptionPaymentCheck {
  status: string;
  isPaid: boolean;
  /** Plano gravado quando o pagamento foi confirmado. */
  subscription?: Subscription;
}

/**
 * Confere no Asaas o pagamento da assinatura e, pago, ativa o plano do espaco.
 * O espaco e o plano vem da referencia gravada na assinatura ao criar o
 * checkout; pagamento de outro espaco e recusado.
 */
export async function confirmSubscriptionPayment(
  admin: SupabaseClient,
  organizationId: string,
  paymentId: string,
  author: PlanAuthor = systemAuthor("webhook.asaas"),
): Promise<SubscriptionPaymentCheck> {
  const payment = await getPayment(paymentId);
  if (!payment.subscription) throw forbiddenError();
  const asaasSubscription = await getSubscription(payment.subscription);
  const reference = decodeSubscriptionReference(asaasSubscription.externalReference);
  if (!reference || reference.organizationId !== organizationId) throw forbiddenError();
  if (!PAID_STATUSES.includes(payment.status)) return { status: payment.status, isPaid: false };

  const current = await readOrganizationSubscription(admin, organizationId);
  // O polling repete a conferencia: o plano ja ativo por esta assinatura fica como esta.
  if (current?.asaasSubscriptionId === asaasSubscription.id && current.tier === reference.tier && current.status === "active") {
    return { status: payment.status, isPaid: true, subscription: current };
  }
  const subscription: Subscription = {
    tier: reference.tier,
    interval: reference.interval,
    status: "active",
    priceCents: SUBSCRIPTION_PRICES[reference.tier][reference.interval].priceCents,
    paymentMethod: payment.billingType === "CREDIT_CARD" ? "credit_card" : "pix",
    asaasSubscriptionId: asaasSubscription.id,
    asaasCustomerId: asaasSubscription.customer,
    // O periodo pago comeca no vencimento desta cobranca.
    renewsOn: addPlanCycle(payment.dueDate, reference.interval),
    nextDueDate: addPlanCycle(payment.dueDate, reference.interval),
    changedAt: new Date().toISOString(),
  };
  await writeOrganizationSubscription(admin, organizationId, subscription);
  await recordActivation(admin, organizationId, author, current, subscription, payment.id);
  return { status: payment.status, isPaid: true, subscription };
}

/** "assinou o Plano Profissional mensal (Pix)": historico do plano e Auditoria. */
export async function recordActivation(
  admin: SupabaseClient,
  organizationId: string,
  author: PlanAuthor,
  before: Subscription | undefined,
  after: Subscription,
  paymentId?: string,
): Promise<void> {
  const interval = after.interval === "yearly" ? "anual" : "mensal";
  const method = after.paymentMethod === "credit_card" ? "cartão" : "Pix";
  await recordSubscriptionEvent(admin, organizationId, author, {
    kind: "activated",
    before,
    after,
    amountCents: after.priceCents,
    paymentId,
    effectiveOn: after.renewsOn,
    predicate: `assinou o Plano ${subscriptionTierLabel(after.tier)} ${interval} (${method})`,
  });
}
