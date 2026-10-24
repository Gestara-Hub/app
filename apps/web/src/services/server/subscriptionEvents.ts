import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditActor, AuditChange, Subscription, SubscriptionEventKind, SubscriptionTier } from "@gestarahub/contracts";
import { subscriptionTierLabel } from "@/lib/labels";
import { logError } from "@/lib/log";
import { recordServerAudit, systemActor, type SystemSource } from "./systemAudit";

/**
 * Historico do Plano GestaraHub (doc technical/23): cada mudanca do plano vira
 * uma linha em `subscription_events` (para sempre) e a mesma frase na
 * Auditoria, ligadas pelo id. Grava junto com o plano, no servidor, em todo
 * caminho: pessoa, webhook ou rotina. Falha ao registrar nunca desfaz a
 * mudanca do plano. Modulo so do servidor.
 */

/** Quem fez: uma pessoa, ou o sistema com a origem. */
export type PlanAuthor = { actor: AuditActor; source?: SystemSource };

export function systemAuthor(source: SystemSource): PlanAuthor {
  return { actor: systemActor(source), source };
}

export interface SubscriptionEventInput {
  kind: SubscriptionEventKind;
  before: Subscription | undefined;
  after: Subscription;
  amountCents?: number;
  paymentId?: string;
  effectiveOn?: string;
  /** Frase sem o autor, para a Auditoria. */
  predicate: string;
  details?: Record<string, unknown>;
}

const tierOf = (s: Subscription | undefined): SubscriptionTier => s?.tier ?? "free";
const intervalLabel = (s: Subscription | undefined) =>
  !s || tierOf(s) === "free" ? "" : s.interval === "yearly" ? " anual" : " mensal";
const planLabel = (s: Subscription | undefined) => `${subscriptionTierLabel(tierOf(s))}${intervalLabel(s)}`;

export async function recordSubscriptionEvent(
  admin: SupabaseClient,
  organizationId: string,
  author: PlanAuthor,
  event: SubscriptionEventInput,
): Promise<void> {
  try {
    const changes: AuditChange[] =
      planLabel(event.before) !== planLabel(event.after)
        ? [{ field: "tier", label: "Plano", before: planLabel(event.before), after: planLabel(event.after) }]
        : [];
    const { data, error } = await admin
      .from("subscription_events")
      .insert({
        organization_id: organizationId,
        kind: event.kind,
        tier_before: event.before ? tierOf(event.before) : null,
        tier_after: tierOf(event.after),
        interval_before: event.before?.interval ?? null,
        interval_after: event.after.interval ?? null,
        amount_cents: event.amountCents ?? null,
        asaas_payment_id: event.paymentId ?? null,
        asaas_subscription_id: event.after.asaasSubscriptionId ?? event.before?.asaasSubscriptionId ?? null,
        effective_on: event.effectiveOn ?? null,
        actor: author.actor,
        source: author.source ?? null,
        details: event.details ?? {},
      })
      .select("id")
      .single();
    if (error) throw error;
    const auditId = await recordServerAudit(admin, {
      organizationId,
      actor: author.actor,
      source: author.source,
      action: "updated",
      target: { type: "subscription", id: String(data.id), label: "Plano GestaraHub" },
      predicate: event.predicate,
      changes,
      // Plano e dinheiro do espaco: so o dono ve.
      security: true,
    });
    if (auditId) await admin.from("subscription_events").update({ audit_log_id: auditId }).eq("id", data.id);
  } catch (error) {
    logError("[subscriptionEvents] Histórico do plano não gravado:", error);
  }
}

export interface SubscriptionEventView {
  id: string;
  kind: SubscriptionEventKind;
  createdAt: string;
  actorName: string;
  /** Sem pessoa (rotina, parceiro de pagamentos). */
  system: boolean;
  tierBefore?: SubscriptionTier;
  tierAfter: SubscriptionTier;
  intervalBefore?: string;
  intervalAfter?: string;
  amountCents?: number;
  effectiveOn?: string;
}

/** O historico do plano, mais recente primeiro. */
export async function listSubscriptionEvents(
  admin: SupabaseClient,
  organizationId: string,
  limit = 100,
): Promise<SubscriptionEventView[]> {
  const { data, error } = await admin
    .from("subscription_events")
    .select("id, kind, created_at, actor, source, tier_before, tier_after, interval_before, interval_after, amount_cents, effective_on")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    kind: row.kind as SubscriptionEventKind,
    createdAt: String(row.created_at),
    actorName: String((row.actor as { name?: string } | null)?.name ?? "Sistema"),
    system: Boolean(row.source),
    ...(row.tier_before ? { tierBefore: row.tier_before as SubscriptionTier } : {}),
    tierAfter: row.tier_after as SubscriptionTier,
    ...(row.interval_before ? { intervalBefore: String(row.interval_before) } : {}),
    ...(row.interval_after ? { intervalAfter: String(row.interval_after) } : {}),
    ...(row.amount_cents != null ? { amountCents: Number(row.amount_cents) } : {}),
    ...(row.effective_on ? { effectiveOn: String(row.effective_on) } : {}),
  }));
}
