import { createHash } from "node:crypto";
import type { GatewayAccountFees, LinkPaymentMethodName } from "@gestarahub/contracts";
import {
  areGatewayFeesStale,
  effectiveGatewayFees,
  isGatewayFeeDivergent,
  parseAsaasAccountFees,
} from "@gestarahub/core/payment-fees";
import { AsaasApiError, asaasToday, createPixAddressKey, createWebhook, getAccountFees, getAccountInfo, listPixAddressKeys, listWebhooks, updateWebhook } from "@/lib/asaas";
import type { AsaasWebhookConfig } from "@/lib/asaas";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError, logWarn } from "@/lib/log";

/**
 * Subconta do espaco no Asaas: tarifas e webhook (doc 19, secao 4, decisao de
 * 21/10/2026). So roda no servidor, chamado por server actions e pela rota do
 * webhook; nao e "use server" de proposito, para nao virar acao chamavel pelo
 * navegador com um organizationId qualquer.
 *
 * Tarifas: buscadas na aprovacao da subconta, de novo quando passam de 24 horas
 * (no uso) e quando um pagamento real diverge da tabela. A conta principal nunca
 * e consultada aqui.
 */

/**
 * Subconta no Asaas: tarifas, webhook do GestaraHub e atualizacao do status.
 */

/** Nome do webhook do GestaraHub em cada subconta (para achar e atualizar, nao duplicar). */
export const GESTARAHUB_WEBHOOK_NAME = "GestaraHub";

/**
 * Avisos que cada subconta manda para app/api/webhooks/asaas (25/11/2026: os
 * que vamos usar, marcados de uma vez). A rota reconhece qualquer aviso e guarda
 * o que ainda nao trata: recusar pausava a fila da subconta. Nomes conferidos
 * na lista do Asaas (POST /v3/webhooks, campo `events`): nome errado faz o
 * cadastro do webhook falhar.
 */
export const WEBHOOK_EVENTS = [
  // Cobrancas de aluno: baixa, vencimento, cancelamento e volta.
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
  "PAYMENT_RESTORED",
  "PAYMENT_UPDATED",
  "PAYMENT_RECEIVED_IN_CASH_UNDONE",
  "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED",
  // Estorno e contestacao (ja tratados: avisam o dono; antes nao eram marcados).
  "PAYMENT_REFUNDED",
  "PAYMENT_PARTIALLY_REFUNDED",
  "PAYMENT_REFUND_IN_PROGRESS",
  "PAYMENT_REFUND_DENIED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE",
  "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
  // Saques via Pix (para depois: situacao do saque sem precisar atualizar).
  "TRANSFER_PENDING",
  "TRANSFER_BLOCKED",
  "TRANSFER_DONE",
  "TRANSFER_FAILED",
  "TRANSFER_CANCELLED",
  // Saldo bloqueado pelo parceiro (para depois).
  "BALANCE_VALUE_BLOCKED",
  "BALANCE_VALUE_UNBLOCKED",
  // Analise da conta (tratados: cartao "Deixe sua conta pronta").
  "ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED",
  "ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL",
  "ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING",
  "ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED",
  "ACCOUNT_STATUS_DOCUMENT_APPROVED",
  "ACCOUNT_STATUS_DOCUMENT_AWAITING_APPROVAL",
  "ACCOUNT_STATUS_DOCUMENT_PENDING",
  "ACCOUNT_STATUS_DOCUMENT_REJECTED",
  "ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED",
  "ACCOUNT_STATUS_COMMERCIAL_INFO_AWAITING_APPROVAL",
  "ACCOUNT_STATUS_COMMERCIAL_INFO_PENDING",
  "ACCOUNT_STATUS_COMMERCIAL_INFO_REJECTED",
  // Confirmacao anual dos dados comerciais e conta bancaria (para depois).
  "ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRING_SOON",
  "ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRED",
  "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_APPROVED",
  "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_AWAITING_APPROVAL",
  "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_PENDING",
  "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_REJECTED",
  // Chave de API da subconta: expira sem uso e o espaco para de cobrar (para depois).
  "ACCESS_TOKEN_CREATED",
  "ACCESS_TOKEN_ENABLED",
  "ACCESS_TOKEN_DISABLED",
  "ACCESS_TOKEN_DELETED",
  "ACCESS_TOKEN_EXPIRING_SOON",
  "ACCESS_TOKEN_EXPIRED",
  // Sem os de Pix Automatico (25/11/2026): subconta sem o recurso liberado faz o
  // Asaas recusar o webhook inteiro ("O Pix Automático não está disponível").
];

/**
 * Lista essencial: se o Asaas recusar a completa (recurso nao liberado na
 * subconta), o webhook sai com esta, para a baixa e a analise nao pararem.
 */
const ESSENTIAL_WEBHOOK_EVENTS = WEBHOOK_EVENTS.filter(
  (event) =>
    event.startsWith("PAYMENT_") ||
    event.startsWith("ACCOUNT_STATUS_GENERAL_APPROVAL_") ||
    event.startsWith("ACCOUNT_STATUS_DOCUMENT_") ||
    (event.startsWith("ACCOUNT_STATUS_COMMERCIAL_INFO_") && !event.includes("EXPIR")),
);

/** Muda quando a lista de eventos muda: entra na impressao e recadastra as subcontas. */
const WEBHOOK_EVENTS_VERSION = "4";

/** Cadastro que falhou nao tenta de novo a cada tela: espera 6 horas (25/11/2026). */
const WEBHOOK_RETRY_AFTER_MS = 6 * 60 * 60 * 1000;
const FAILED_MARK = "#falhou@";

/** O cadastro desta impressao falhou ha menos de 6 horas? */
export function webhookRecentlyFailed(saved: unknown, fingerprint: string, now = Date.now()): boolean {
  if (typeof saved !== "string" || !saved.startsWith(`${fingerprint}${FAILED_MARK}`)) return false;
  const at = Date.parse(saved.slice(fingerprint.length + FAILED_MARK.length));
  return Number.isFinite(at) && now - at < WEBHOOK_RETRY_AFTER_MS;
}

/**
 * O que fica gravado em `gateway_webhook_url`: a URL e uma impressao curta do
 * token (nunca o token). Trocar a URL ou a ASAAS_WEBHOOK_SECRET muda o valor, e
 * a subconta e recadastrada sozinha na proxima leitura (19/11/2026: com o token
 * novo, os avisos das subcontas eram recusados e o Asaas pausava a fila).
 */
export function webhookFingerprint(url: string, authToken: string): string {
  const print = createHash("sha256").update(authToken, "utf8").digest("hex").slice(0, 12);
  // Versao dos eventos (25/11/2026): as subcontas ja cadastradas ganham os avisos novos.
  return `${url}#${print}#e${WEBHOOK_EVENTS_VERSION}`;
}

/** Chave de subconta de verdade (as do modo de demonstracao comecam com "mock_"). */
export function realSubaccountKey(key: unknown): string | null {
  return typeof key === "string" && key.length > 0 && !key.startsWith("mock_") ? key : null;
}

/**
 * Garante uma chave Pix (aleatoria) na subconta recem-criada (01/11/2026): sem
 * ela, o primeiro Pix do espaco falhava no QR e so o segundo saia. Falha aqui
 * nao desfaz a ativacao: o adaptador tenta criar a chave de novo na hora do Pix.
 */
export async function ensureSubaccountPixKey(organizationId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("gateway_api_key")
    .eq("id", organizationId)
    .maybeSingle();
  const key = realSubaccountKey(org?.gateway_api_key);
  if (!key || !process.env.ASAAS_API_KEY) return false;
  try {
    const keys = await listPixAddressKeys(key);
    if (keys.some((k) => k.status !== "ERROR" && k.status !== "REMOVED")) return true;
    await createPixAddressKey(key);
    return true;
  } catch (err) {
    logWarn("[gatewayAccount] Não foi possível criar a chave Pix da subconta (o Pix tenta de novo na primeira cobrança):", err);
    return false;
  }
}

/** Busca as tarifas da subconta no Asaas e grava em organizations.gateway_fees. */
export async function syncGatewayFees(organizationId: string): Promise<GatewayAccountFees | null> {
  const admin = createSupabaseAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("gateway_api_key")
    .eq("id", organizationId)
    .maybeSingle();
  const key = realSubaccountKey(org?.gateway_api_key);
  if (!key || !process.env.ASAAS_API_KEY) return null;

  try {
    const syncedAt = new Date().toISOString();
    const fees = parseAsaasAccountFees(await getAccountFees(key), syncedAt);
    const { error } = await admin
      .from("organizations")
      .update({ gateway_fees: fees, gateway_fees_synced_at: syncedAt })
      .eq("id", organizationId);
    if (error) throw error;
    return fees;
  } catch (err) {
    logError("[gatewayAccount] Não foi possível buscar as tarifas da subconta:", err);
    return null;
  }
}

/** E-mail da conta principal (chave ASAAS_API_KEY), guardado depois da primeira leitura. */
let cachedMasterEmail: string | undefined;

async function masterAccountEmail(): Promise<string | undefined> {
  if (cachedMasterEmail) return cachedMasterEmail;
  try {
    const info = await getAccountInfo();
    cachedMasterEmail = typeof info.email === "string" && info.email ? info.email : undefined;
  } catch (err) {
    logError("[gatewayAccount] Não foi possível ler o e-mail da conta principal:", err);
  }
  return cachedMasterEmail;
}

/**
 * Cadastra (ou atualiza) o webhook do GestaraHub na subconta, com a URL de
 * ASAAS_WEBHOOK_URL e o token de ASAAS_WEBHOOK_SECRET. Sem as duas variaveis,
 * nao faz nada e avisa no log: a subconta segue funcionando, so sem baixa
 * automatica (resta o "Simular liquidacao" no sandbox).
 */
export async function ensureSubaccountWebhook(
  organizationId: string,
): Promise<{ configured: boolean; reason?: string }> {
  const url = process.env.ASAAS_WEBHOOK_URL?.trim();
  const authToken = process.env.ASAAS_WEBHOOK_SECRET?.trim();
  if (!url || !authToken) {
    const reason = "ASAAS_WEBHOOK_URL ou ASAAS_WEBHOOK_SECRET não configuradas.";
    logWarn(`[gatewayAccount] Webhook da subconta não cadastrado: ${reason}`);
    return { configured: false, reason };
  }

  const admin = createSupabaseAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("gateway_api_key")
    .eq("id", organizationId)
    .maybeSingle();
  const key = realSubaccountKey(org?.gateway_api_key);
  if (!key) return { configured: false, reason: "Organização sem subconta no Asaas." };

  // O Asaas exige e-mail (avisa nele se o webhook falhar). Sem ASAAS_WEBHOOK_EMAIL,
  // usa o da conta principal: o aviso vai para o GestaraHub, nunca para o espaco.
  const email = process.env.ASAAS_WEBHOOK_EMAIL?.trim() || (await masterAccountEmail());
  if (!email) {
    const reason = "Sem e-mail para o webhook: defina ASAAS_WEBHOOK_EMAIL.";
    logWarn(`[gatewayAccount] Webhook da subconta não cadastrado: ${reason}`);
    return { configured: false, reason };
  }

  const config: AsaasWebhookConfig = {
    name: GESTARAHUB_WEBHOOK_NAME,
    url,
    email,
    enabled: true,
    interrupted: false,
    apiVersion: 3,
    authToken,
    sendType: "SEQUENTIALLY",
    events: WEBHOOK_EVENTS,
  };

  const fingerprint = webhookFingerprint(url, authToken);
  try {
    const existing = (await listWebhooks(key)).find((w) => w.name === GESTARAHUB_WEBHOOK_NAME);
    const save = (events: string[]) =>
      existing ? updateWebhook(existing.id, { ...config, events }, key) : createWebhook({ ...config, events }, key);
    try {
      await save(WEBHOOK_EVENTS);
    } catch (err) {
      // Recurso nao liberado na subconta (400): vai com a lista essencial.
      if (!(err instanceof AsaasApiError) || err.status !== 400) throw err;
      logWarn("[gatewayAccount] Webhook completo recusado pela subconta; cadastrado com os avisos essenciais:", err.message);
      await save(ESSENTIAL_WEBHOOK_EVENTS);
    }
    await admin.from("organizations").update({ gateway_webhook_url: fingerprint }).eq("id", organizationId);
    return { configured: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logError("[gatewayAccount] Não foi possível cadastrar o webhook da subconta:", err);
    // Marca a falha: a proxima tentativa so depois de 6 horas, nao a cada tela.
    await admin
      .from("organizations")
      .update({ gateway_webhook_url: `${fingerprint}${FAILED_MARK}${new Date().toISOString()}` })
      .eq("id", organizationId);
    return { configured: false, reason };
  }
}

/**
 * Atualizacao por idade e por troca de URL, chamada quando o app le a
 * organizacao (em `after`, sem atrasar a resposta): tarifas com mais de 24
 * horas sao buscadas de novo; URL ou token do webhook diferentes dos
 * cadastrados: recadastra (o cadastro tambem religa a fila pausada).
 */
export async function refreshGatewayIfNeeded(row: {
  id: string;
  gateway_api_key?: unknown;
  gateway_fees?: unknown;
  gateway_webhook_url?: unknown;
}): Promise<void> {
  if (!realSubaccountKey(row.gateway_api_key)) return;
  // Vencidos e cancelamentos pendentes ficam com o cron de hora em hora
  // (/api/cron/online-payments): aqui rodavam a cada leitura da organizacao.
  const fees = (row.gateway_fees ?? undefined) as GatewayAccountFees | undefined;
  if (areGatewayFeesStale(fees, new Date())) await syncGatewayFees(row.id);
  const url = process.env.ASAAS_WEBHOOK_URL?.trim();
  const authToken = process.env.ASAAS_WEBHOOK_SECRET?.trim();
  const fingerprint = url && authToken ? webhookFingerprint(url, authToken) : null;
  if (fingerprint && fingerprint !== row.gateway_webhook_url && !webhookRecentlyFailed(row.gateway_webhook_url, fingerprint)) {
    await ensureSubaccountWebhook(row.id);
  }
}

/**
 * Depois de um pagamento real: se a tarifa cobrada pelo Asaas nao bate com a
 * tabela gravada para aquele meio, a tarifa da subconta mudou; busca de novo.
 */
export async function recheckFeesAfterPayment(input: {
  organizationId: string;
  paidMethod?: LinkPaymentMethodName;
  chargedCents: number;
  realFeeCents?: number;
}): Promise<void> {
  if (!input.paidMethod || input.realFeeCents === undefined) return;
  const admin = createSupabaseAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("gateway_fees")
    .eq("id", input.organizationId)
    .maybeSingle();
  const fees = (org?.gateway_fees ?? undefined) as GatewayAccountFees | undefined;
  const table = effectiveGatewayFees(fees, asaasToday());
  if (isGatewayFeeDivergent(table, input.paidMethod, input.chargedCents, input.realFeeCents)) {
    console.info("[gatewayAccount] Tarifa real diferente da tabela; buscando as tarifas da subconta de novo.");
    await syncGatewayFees(input.organizationId);
  }
}

// --- Cancelamento no Asaas ----------------------------------------------------
