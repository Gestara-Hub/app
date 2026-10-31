"use server";

import { randomUUID } from "node:crypto";
import type { Address, OnlinePaymentMethod, OnlinePaymentSettings, StudentGuardian } from "@gestarahub/contracts";
import { todayISO } from "@gestarahub/core/date";
import { cpfDigits, isValidCpf, resolveOnlinePayer, type OnlinePayer } from "@gestarahub/core/payer";
import {
  ASAAS_BILLING_TYPE,
  availableOnlineMethods,
  calculateOnlineChargeAmounts,
  defaultPassFeeFor,
  effectiveGatewayFees,
  type PlatformTier,
} from "@gestarahub/core/payment-fees";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError, logWarn } from "@/lib/log";
import { getPaymentGateway } from "@/services/payments/registry";
import { effectivePlatformSplitCents } from "@/services/payments/platformSplit";
import { cancelGatewayPayment } from "@/services/onlinePayments/gatewayCleanup";
import { realSubaccountKey } from "@/services/onlinePayments/gatewaySetup";
import { newPublicCode } from "@/services/onlinePayments/onlinePaymentRules";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

/**
 * Fatura publica da cobranca (/p/c/<id>, doc technical/25 §7): o aluno escolhe
 * a forma e gera o Pix, o link do cartao ou o boleto, sem login. So o banco:
 * nada da simulacao local roda aqui.
 *
 * - O CPF digitado vale so para esta cobranca: nao e gravado no cadastro (a
 *   pagina e aberta sem login, por quem tiver o link).
 * - Aluno menor sem responsavel financeiro: o espaco cadastra o responsavel
 *   (mesma regra do "Cobrar online" no app).
 * - Codigos em aberto da cobranca saem tambem no Asaas, senao o codigo antigo
 *   ainda pode ser pago (pagamento em dobro).
 * - Falha ao gravar o codigo novo: ele e cancelado no Asaas (nao fica orfao).
 */

export interface CreatePublicPaymentResult {
  ok: boolean;
  error?: string;
  method?: OnlinePaymentMethod;
  publicCode?: string;
  pixCopyPaste?: string;
  linkUrl?: string;
  expiresAt?: string;
}

type Row = Record<string, unknown>;

async function loadCharge(admin: SupabaseClient, chargeId: string) {
  const { data: charge, error } = await admin
    .from("charges")
    .select("id, organization_id, student_id, amount_cents, due_date, status, kind, description, competence")
    .eq("id", chargeId)
    .maybeSingle();
  if (error) throw error;
  if (!charge) return null;
  const [orgRes, clientRes] = await Promise.all([
    admin.from("organizations").select("id, name, settings, subscription, gateway_api_key").eq("id", charge.organization_id).maybeSingle(),
    admin
      .from("clients")
      .select("id, name, cpf, phone, email, birth_date, guardians, address")
      .eq("id", charge.student_id)
      .maybeSingle(),
  ]);
  if (orgRes.error) throw orgRes.error;
  if (clientRes.error) throw clientRes.error;
  return { charge: charge as Row, org: (orgRes.data as Row | null) ?? null, client: (clientRes.data as Row | null) ?? null };
}

/** Quem paga: o do cadastro; sem CPF no cadastro, o CPF digitado vale so para esta cobranca. */
function payerFor(client: Row | null, typedCpf: string | undefined): { payer?: OnlinePayer; error?: string } {
  const student = {
    name: String(client?.name || "Aluno"),
    cpf: client?.cpf ? String(client.cpf) : undefined,
    phone: client?.phone ? String(client.phone) : "",
    email: client?.email ? String(client.email) : undefined,
    birthDate: client?.birth_date ? String(client.birth_date) : undefined,
    guardians: (client?.guardians as StudentGuardian[] | undefined) ?? undefined,
  };
  const resolved = resolveOnlinePayer(student, todayISO());
  if (resolved.ok) return { payer: resolved.payer };
  if (resolved.reason === "guardian_cpf_missing") {
    return { error: "Aluno menor de idade: peça ao espaço para cadastrar o responsável financeiro." };
  }
  if (!typedCpf || !isValidCpf(typedCpf)) return { error: "Informe um CPF válido para gerar o pagamento." };
  return {
    payer: { name: student.name, cpf: cpfDigits(typedCpf), phone: student.phone || undefined, email: student.email, kind: "student" },
  };
}

/** Cancela os codigos em aberto da cobranca, no Asaas e no banco (exceto `keepId`). */
async function cancelOpenPayments(
  admin: SupabaseClient,
  chargeId: string,
  subaccountKey: string | null,
  keepId?: string,
): Promise<void> {
  const { data: rows, error } = await admin
    .from("online_payments")
    .select("id, gateway_provider, gateway_payment_id")
    .eq("charge_id", chargeId)
    .eq("status", "awaiting");
  if (error) throw error;
  const toCancel: string[] = [];
  const pendingAtGateway: string[] = [];
  for (const row of rows ?? []) {
    if (String(row.id) === keepId) continue;
    if (row.gateway_provider === "asaas" && row.gateway_payment_id && subaccountKey) {
      const result = await cancelGatewayPayment(String(row.gateway_payment_id), subaccountKey);
      // Ja paga no Asaas: o webhook da a baixa; nao cancela aqui.
      if (result === "paid") continue;
      if (result === "failed") pendingAtGateway.push(String(row.id));
    }
    toCancel.push(String(row.id));
  }
  if (toCancel.length === 0) return;
  const { error: cancelError } = await admin
    .from("online_payments")
    .update({ status: "canceled", canceled_reason: "Substituído por novo código" })
    .in("id", toCancel);
  if (cancelError) throw cancelError;
  // Falhou no Asaas: marcado para a rotina de hora em hora tentar de novo.
  if (pendingAtGateway.length > 0) {
    const { error: pendingError } = await admin
      .from("online_payments")
      .update({ gateway_cancel_pending: true })
      .in("id", pendingAtGateway);
    if (pendingError) logWarn("[chargeInvoiceActions] Cancelamento pendente no Asaas não marcado:", pendingError);
  }
}

/**
 * Cria (ou devolve, se ja existe na mesma forma) o pagamento online da cobranca
 * pela pagina publica da fatura.
 */
export async function createPublicChargePaymentAction(input: {
  chargeId: string;
  method: "pix" | "link" | "boleto";
  cpf?: string;
}): Promise<CreatePublicPaymentResult> {
  const chargeId = String(input?.chargeId ?? "");
  const method = input?.method;
  if (!chargeId || !method) return { ok: false, error: "Dados inválidos." };

  // Pagina publica (auditoria de 30/10/2026): cada pedido cria um pagamento no
  // parceiro e cancela o anterior. Sem limite, alternar a forma gerava e
  // cancelava sem parar (e podia cancelar o Pix que o aluno estava pagando).
  const ip = await getClientIp().catch(() => "desconhecido");
  const allowed =
    (await checkRateLimit({ key: `public_invoice:${ip}:${chargeId}`, maxRequests: 6, windowSeconds: 600 })) &&
    (await checkRateLimit({ key: `public_invoice_charge:${chargeId}`, maxRequests: 15, windowSeconds: 3600 }));
  if (!allowed) return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };

  const admin = createSupabaseAdminClient();
  const now = new Date();

  let loaded: Awaited<ReturnType<typeof loadCharge>>;
  try {
    loaded = await loadCharge(admin, chargeId);
  } catch (err) {
    logError("[chargeInvoiceActions] Erro ao ler a cobrança:", err);
    return { ok: false, error: "Não foi possível abrir a cobrança. Tente de novo em instantes." };
  }
  if (!loaded) return { ok: false, error: "Cobrança não encontrada." };
  const { charge, org, client } = loaded;

  if (charge.status === "paid") return { ok: false, error: "Esta cobrança já foi paga." };
  if (charge.status === "canceled") return { ok: false, error: "Esta cobrança foi cancelada." };

  const orgSettings = (org?.settings as Row | null) ?? {};
  const onlineSettings = (orgSettings.onlinePayments as OnlinePaymentSettings | null) ?? undefined;
  if (!onlineSettings?.enabled) return { ok: false, error: "O pagamento online não está disponível para esta cobrança." };
  // So as formas ligadas em Recebimentos online.
  if (!availableOnlineMethods(onlineSettings).includes(method)) {
    return { ok: false, error: "Esta forma de pagamento não está disponível. Escolha outra." };
  }

  const { payer, error: payerError } = payerFor(client, input.cpf);
  if (!payer) return { ok: false, error: payerError ?? "Não foi possível validar os dados do pagador." };

  // Ja existe um codigo valido na mesma forma: devolve o mesmo.
  const { data: existing, error: existingError } = await admin
    .from("online_payments")
    .select("id, method, pix_copy_paste, link_url, public_code, expires_at")
    .eq("charge_id", chargeId)
    .eq("method", method)
    .eq("status", "awaiting")
    .gt("expires_at", now.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) logWarn("[chargeInvoiceActions] Falha ao procurar o código em aberto:", existingError);
  if (existing?.public_code) {
    return {
      ok: true,
      method,
      publicCode: String(existing.public_code),
      pixCopyPaste: existing.pix_copy_paste ? String(existing.pix_copy_paste) : undefined,
      linkUrl: existing.link_url ? String(existing.link_url) : undefined,
      expiresAt: new Date(String(existing.expires_at)).toISOString(),
    };
  }

  // Valores e tarifas (mesma conta do "Cobrar online").
  const tier = ((org?.subscription as Row | null)?.tier as PlatformTier | undefined) ?? "free";
  const splitAmountCents = effectivePlatformSplitCents(tier);
  const passFee = defaultPassFeeFor(onlineSettings, method);
  const { chargedAmountCents, gatewayFeeCents, netAmountCents } = calculateOnlineChargeAmounts({
    amountCents: Number(charge.amount_cents) || 0,
    method,
    splitAmountCents,
    passFee,
    fees: effectiveGatewayFees(onlineSettings.gatewayFees, todayISO()),
  });

  const subaccountKey = realSubaccountKey(org?.gateway_api_key as string | null | undefined);
  const gateway = getPaymentGateway(undefined);
  const expiresInMinutes = onlineSettings.defaultExpiresInMinutes || 1440;
  const common = {
    chargeId,
    amountCents: chargedAmountCents,
    splitAmountCents,
    expiresInMinutes,
    studentId: String(charge.student_id),
    studentName: payer.name,
    studentCpf: payer.cpf,
    studentPhone: payer.phone,
    studentEmail: payer.email,
    studentAddress: (client?.address as Address | undefined) ?? undefined,
    chargeDueDate: String(charge.due_date),
    competence: charge.competence ? String(charge.competence) : undefined,
    description: charge.description ? String(charge.description) : undefined,
    subaccountApiKey: subaccountKey ?? undefined,
  };

  let provided: { provider?: string; providerId?: string; pixCopyPaste?: string; linkUrl?: string; expiresAt: string };
  try {
    provided =
      method === "pix"
        ? await gateway.createPix({ ...common, pixKey: onlineSettings.pixKey, merchantName: String(org?.name ?? "GestaraHub") })
        : await gateway.createLink({
            ...common,
            billingType: (ASAAS_BILLING_TYPE[method] || "CREDIT_CARD") as "CREDIT_CARD" | "BOLETO" | "UNDEFINED",
          });
  } catch (gatewayErr) {
    logError("[chargeInvoiceActions] Erro no parceiro ao gerar o pagamento:", gatewayErr);
    return { ok: false, error: "Não foi possível gerar o pagamento agora. Tente de novo em instantes." };
  }

  const paymentId = randomUUID();
  const publicCode = newPublicCode();
  const { error: insertError } = await admin.from("online_payments").insert({
    id: paymentId,
    organization_id: charge.organization_id,
    charge_id: chargeId,
    client_id: charge.student_id,
    method,
    status: "awaiting",
    amount_cents: chargedAmountCents,
    split_amount_cents: splitAmountCents,
    gateway_fee_cents: gatewayFeeCents,
    net_amount_cents: netAmountCents,
    gateway_provider: provided.provider ?? "asaas",
    gateway_payment_id: provided.providerId ?? null,
    pix_copy_paste: provided.pixCopyPaste ?? null,
    link_url: provided.linkUrl ?? null,
    public_code: publicCode,
    fee_passed_to_customer: passFee,
    expires_at: provided.expiresAt,
  });
  if (insertError) {
    logError("[chargeInvoiceActions] Código gerado no parceiro não foi gravado:", insertError);
    // Sem registro aqui, o webhook nao acharia o pagamento: cancela no Asaas.
    if (provided.provider === "asaas" && provided.providerId && subaccountKey) {
      await cancelGatewayPayment(provided.providerId, subaccountKey);
    }
    return { ok: false, error: "Não foi possível gerar o pagamento agora. Tente de novo em instantes." };
  }

  // Um codigo valido por vez: os anteriores saem (no Asaas e aqui).
  try {
    await cancelOpenPayments(admin, chargeId, subaccountKey, paymentId);
  } catch (cancelErr) {
    logWarn("[chargeInvoiceActions] Códigos anteriores não cancelados:", cancelErr);
  }

  return {
    ok: true,
    method,
    publicCode,
    pixCopyPaste: provided.pixCopyPaste,
    linkUrl: provided.linkUrl,
    expiresAt: provided.expiresAt,
  };
}

/** Situacao da cobranca para a tela da fatura conferir o pagamento. */
export async function checkPublicChargeStatusAction(
  chargeId: string,
): Promise<{ status: "pending" | "paid" | "canceled" }> {
  if (!chargeId) return { status: "pending" };
  const { data: charge, error } = await createSupabaseAdminClient()
    .from("charges")
    .select("status")
    .eq("id", String(chargeId))
    .maybeSingle();
  if (error) {
    logWarn("[chargeInvoiceActions] Falha ao conferir a cobrança:", error);
    return { status: "pending" };
  }
  if (charge?.status === "paid") return { status: "paid" };
  if (charge?.status === "canceled") return { status: "canceled" };
  return { status: "pending" };
}
