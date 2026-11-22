import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformInvoiceKind, PlatformInvoiceStatus, PlatformInvoiceView, Subscription } from "@gestarahub/contracts";
import { addDays, format, parseISO } from "date-fns";
import { addPlanCycle } from "@gestarahub/core/subscription-plan";
import {
  AsaasApiError,
  asaasToday,
  cancelInvoice,
  createInvoice,
  getAsaasConfig,
  getAsaasNfseConfig,
  getInvoice,
  listPaymentInvoices,
  type AsaasInvoiceResponse,
  type AsaasInvoiceStatus,
} from "@/lib/asaas";
import { afterResponse } from "@/lib/after-response";
import { sendPlanNoticeEmail } from "@/lib/email/ses";
import { subscriptionTierLabel } from "@/lib/labels";
import { logWarn, reportError } from "@/lib/log";
import { formatCents } from "@gestarahub/core/format";
import { recordSystemAudit } from "./systemAudit";

/**
 * Nota fiscal (NFS-e) do Plano GestaraHub pela conta principal do Asaas (doc
 * technical/24 §7.1, 22/11/2026). Uma nota por pagamento confirmado, sempre
 * depois de pago (nunca no Pix pendente): renovacao da assinatura ou diferenca
 * da troca de plano. Pedida aqui, e nao pela configuracao de nota da assinatura
 * no Asaas, para cada nota levar o periodo pago. Sem as variaveis ASAAS_NFSE_*,
 * nada acontece. A nota nunca derruba o pagamento: falha vai para o registro de
 * erros e a rotina diaria tenta de novo. Modulo so do servidor, sem "use server".
 */

const MAX_ATTEMPTS = 5;
const MOCK_PREFIX = "pay_mock";

const STATUS_OF: Record<AsaasInvoiceStatus, PlatformInvoiceStatus> = {
  SCHEDULED: "scheduled",
  SYNCHRONIZED: "synchronized",
  AUTHORIZED: "authorized",
  PROCESSING_CANCELLATION: "processing_cancellation",
  CANCELED: "canceled",
  CANCELLATION_DENIED: "cancellation_denied",
  ERROR: "error",
};

const dayBefore = (date: string) => format(addDays(parseISO(date), -1), "yyyy-MM-dd");
const ddmmyyyy = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;

function planLabel(plan: Pick<Subscription, "tier" | "interval">): string {
  return `${subscriptionTierLabel(plan.tier)} ${plan.interval === "yearly" ? "anual" : "mensal"}`;
}

/** "Assinatura do sistema GestaraHub, plano Profissional mensal, período 22/11/2026 a 21/12/2026." */
export function subscriptionInvoiceDescription(plan: Pick<Subscription, "tier" | "interval">, periodStart: string): string {
  const end = dayBefore(addPlanCycle(periodStart, plan.interval ?? "monthly"));
  return `Assinatura do sistema GestaraHub, plano ${planLabel(plan)}, período ${ddmmyyyy(periodStart)} a ${ddmmyyyy(end)}.`;
}

/** Diferenca proporcional da troca: mesmo codigo, nota so com o valor pago (contabilidade, 22/11/2026). */
export function upgradeInvoiceDescription(plan: Pick<Subscription, "tier" | "interval">, from: string, until: string): string {
  return `Assinatura do sistema GestaraHub, diferença proporcional da troca para o plano ${planLabel(plan)}, período ${ddmmyyyy(from)} a ${ddmmyyyy(dayBefore(until))}.`;
}

export interface PlanInvoiceRequest {
  organizationId: string;
  payment: { id: string; value: number };
  kind: Extract<PlatformInvoiceKind, "subscription" | "plan_upgrade">;
  serviceDescription: string;
}

function invoiceRow(invoice: AsaasInvoiceResponse) {
  const status = STATUS_OF[invoice.status] ?? "scheduled";
  return {
    asaas_invoice_id: invoice.id,
    status,
    effective_date: invoice.effectiveDate ?? null,
    invoice_number: invoice.number ?? null,
    validation_code: invoice.validationCode ?? null,
    pdf_url: invoice.pdfUrl ?? null,
    xml_url: invoice.xmlUrl ?? null,
    status_description: status === "error" ? (invoice.statusDescription ?? null) : null,
    ...(status === "authorized" ? { issued_at: new Date().toISOString() } : {}),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Pede a nota de um pagamento confirmado. Idempotente: o polling da tela e o
 * webhook confirmam o mesmo pagamento, e a linha reservada no banco (indice
 * unico por cobranca) deixa so um pedido chegar ao Asaas.
 */
export async function ensurePlanInvoice(admin: SupabaseClient, input: PlanInvoiceRequest): Promise<void> {
  const config = getAsaasNfseConfig();
  if (!config || !getAsaasConfig().masterApiKey || input.payment.id.startsWith(MOCK_PREFIX)) return;

  const { data: reserved, error } = await admin
    .from("platform_invoices")
    .insert({
      organization_id: input.organizationId,
      kind: input.kind,
      asaas_payment_id: input.payment.id,
      external_reference: `plan-invoice:${input.organizationId}:${input.payment.id}`,
      status: "requesting",
      amount_cents: Math.round(input.payment.value * 100),
      service_description: input.serviceDescription,
    })
    .select("id")
    .maybeSingle();
  // 23505: a cobranca ja tem nota (ou pedido em andamento).
  if (error?.code === "23505") return;
  if (error) throw error;
  await requestOnAsaas(admin, String(reserved!.id), input);
}

async function requestOnAsaas(
  admin: SupabaseClient,
  rowId: string,
  input: PlanInvoiceRequest & { attempts?: number },
): Promise<void> {
  const config = getAsaasNfseConfig();
  if (!config) return;
  try {
    // Pedido anterior que chegou ao Asaas mas voltou sem resposta: reaproveita.
    const existing = (await listPaymentInvoices(input.payment.id)).find((inv) => inv.status !== "CANCELED");
    const invoice =
      existing ??
      (await createInvoice({
        payment: input.payment.id,
        serviceDescription: input.serviceDescription,
        observations: "",
        value: input.payment.value,
        deductions: 0,
        effectiveDate: asaasToday(),
        externalReference: `plan-invoice:${input.organizationId}:${input.payment.id}`,
        ...config.service,
        taxes: config.taxes,
      }));
    await admin.from("platform_invoices").update(invoiceRow(invoice)).eq("id", rowId).throwOnError();
  } catch (err) {
    const description = err instanceof AsaasApiError ? err.message : "Falha ao pedir a nota ao parceiro.";
    await admin
      .from("platform_invoices")
      .update({ status: "error", status_description: description, attempts: (input.attempts ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq("id", rowId);
    await reportError("invoice.asaas.create", err, {
      source: "server",
      organizationId: input.organizationId,
      context: { paymentId: input.payment.id, kind: input.kind },
    });
  }
}

/** Depois da resposta: a tela de pagamento nao espera a nota. */
export function queuePlanInvoice(admin: SupabaseClient, input: PlanInvoiceRequest): Promise<void> {
  if (!getAsaasNfseConfig()) return Promise.resolve();
  return afterResponse("plano: nota fiscal", () => ensurePlanInvoice(admin, input));
}

/** Rotina diaria: pedidos que falharam ao criar (Asaas fora, cadastro incompleto corrigido). */
export async function retryFailedPlanInvoices(admin: SupabaseClient): Promise<number> {
  if (!getAsaasNfseConfig()) return 0;
  const { data } = await admin
    .from("platform_invoices")
    .select("id, organization_id, kind, asaas_payment_id, amount_cents, service_description, attempts, status, updated_at")
    .is("asaas_invoice_id", null)
    .in("status", ["error", "requesting"])
    .lt("attempts", MAX_ATTEMPTS)
    .lt("updated_at", new Date(Date.now() - 10 * 60_000).toISOString());
  for (const row of data ?? []) {
    await requestOnAsaas(admin, String(row.id), {
      organizationId: String(row.organization_id),
      kind: row.kind as PlanInvoiceRequest["kind"],
      payment: { id: String(row.asaas_payment_id), value: Number(row.amount_cents) / 100 },
      serviceDescription: String(row.service_description),
      attempts: Number(row.attempts),
    });
  }
  return data?.length ?? 0;
}

/**
 * Aviso INVOICE_* do Asaas: reconsulta a nota na conta principal (nunca confia
 * no corpo do aviso) e atualiza a linha. Nota que nao e do plano (feita a mao
 * no painel do Asaas) e ignorada. Devolve o espaco, ou null.
 */
export async function syncPlanInvoiceFromWebhook(
  admin: SupabaseClient,
  webhookInvoice: { id: string; payment?: string | null },
): Promise<string | null> {
  const verified = await getInvoice(webhookInvoice.id);
  const byInvoice = await admin
    .from("platform_invoices")
    .select("id, organization_id, status, invoice_number")
    .eq("asaas_invoice_id", verified.id)
    .maybeSingle();
  let row = byInvoice.data;
  if (!row && verified.payment) {
    const byPayment = await admin
      .from("platform_invoices")
      .select("id, organization_id, status, invoice_number")
      .eq("asaas_payment_id", verified.payment)
      .neq("status", "canceled")
      .maybeSingle();
    row = byPayment.data;
  }
  if (!row) return null;

  const organizationId = String(row.organization_id);
  const next = invoiceRow(verified);
  // A data de emissao fica a da primeira vez.
  if (row.status === "authorized") delete (next as { issued_at?: string }).issued_at;
  await admin.from("platform_invoices").update(next).eq("id", row.id).throwOnError();

  if (next.status === "authorized" && row.status !== "authorized") {
    await recordSystemAudit(admin, "webhook.asaas", {
      organizationId,
      action: "updated",
      target: { type: "subscription", id: organizationId, label: "Plano GestaraHub" },
      predicate: `emitiu a nota fiscal${verified.number ? ` nº ${verified.number}` : ""} do Plano GestaraHub (${formatCents(Math.round(verified.value * 100))})`,
    });
  }
  if (next.status === "error" && row.status !== "error") {
    await reportError("invoice.asaas.error", new Error(verified.statusDescription || "Nota fiscal recusada."), {
      source: "webhook",
      organizationId,
      context: { invoiceId: verified.id, paymentId: verified.payment },
    });
  }
  return organizationId;
}

/**
 * Estorno do pagamento do plano: cancela a nota (contabilidade, 22/11/2026:
 * basta cancelar). Emitida em outro mes, o imposto pode ja estar fechado: a
 * equipe recebe um e-mail para avisar a contabilidade, que retifica.
 */
export async function cancelPlanInvoiceOfPayment(admin: SupabaseClient, organizationId: string, paymentId: string): Promise<void> {
  if (!getAsaasNfseConfig()) return;
  const { data: row } = await admin
    .from("platform_invoices")
    .select("id, asaas_invoice_id, status, effective_date, invoice_number, amount_cents")
    .eq("organization_id", organizationId)
    .eq("asaas_payment_id", paymentId)
    .neq("status", "canceled")
    .maybeSingle();
  if (!row) return;
  if (!row.asaas_invoice_id) {
    // Pedido que nunca virou nota: so encerra a linha.
    await admin.from("platform_invoices").update({ status: "canceled", updated_at: new Date().toISOString() }).eq("id", row.id);
    return;
  }
  try {
    const canceled = await cancelInvoice(String(row.asaas_invoice_id));
    await admin.from("platform_invoices").update(invoiceRow(canceled)).eq("id", row.id);
  } catch (err) {
    await reportError("invoice.asaas.cancel", err, { source: "webhook", organizationId, context: { paymentId } });
    return;
  }
  const issuedMonth = row.effective_date ? String(row.effective_date).slice(0, 7) : undefined;
  if (row.status === "authorized" && issuedMonth && issuedMonth !== asaasToday().slice(0, 7)) {
    await notifyAccountant(row);
  }
}

async function notifyAccountant(row: { invoice_number?: string | null; effective_date?: string | null; amount_cents?: number | null }) {
  const to = (process.env.ASAAS_NFSE_NOTIFY_EMAIL || process.env.ERROR_DIGEST_EMAIL)?.trim();
  if (!to) {
    logWarn("[subscriptionInvoices] Nota de outro mês cancelada, sem e-mail para avisar a contabilidade.");
    return;
  }
  const number = row.invoice_number ? `nº ${row.invoice_number}` : "sem número";
  await sendPlanNoticeEmail({
    toEmail: to,
    toName: "",
    title: "Nota fiscal de outro mês cancelada",
    text: `A nota ${number}, de ${ddmmyyyy(String(row.effective_date))}, no valor de ${formatCents(Number(row.amount_cents ?? 0))}, foi cancelada por estorno. Avise a contabilidade: o imposto desse mês pode precisar de retificação.`,
    actionLabel: "Abrir o Asaas",
    actionUrl: "https://www.asaas.com/invoice/list",
  }).catch((err) => logWarn("[subscriptionInvoices] Aviso à contabilidade não enviado:", err));
}

/** Notas do espaco, mais recente primeiro. */
export async function listPlatformInvoices(admin: SupabaseClient, organizationId: string): Promise<PlatformInvoiceView[]> {
  const { data, error } = await admin
    .from("platform_invoices")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data ?? []).map(toView);
}

export function toView(row: Record<string, unknown>): PlatformInvoiceView {
  const opt = (value: unknown) => (value ? String(value) : undefined);
  return {
    id: String(row.id),
    kind: row.kind as PlatformInvoiceKind,
    status: row.status as PlatformInvoiceStatus,
    amountCents: Number(row.amount_cents),
    serviceDescription: String(row.service_description),
    invoiceNumber: opt(row.invoice_number),
    pdfUrl: opt(row.pdf_url),
    xmlUrl: opt(row.xml_url),
    statusDescription: opt(row.status_description),
    effectiveDate: opt(row.effective_date),
    issuedAt: opt(row.issued_at),
    createdAt: String(row.created_at),
  };
}
