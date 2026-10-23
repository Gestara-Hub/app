"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import type { Id, OnlinePayment, OnlinePaymentSettings } from "@gestarahub/contracts";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { getClientForTenant } from "@/lib/supabase/tenant-client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  CreateLinkInput,
  CreatePixInput,
  PaymentLinkPayment,
  PixPayment,
} from "./payments/types";
import { forbiddenError } from "@gestarahub/core/api-error";
import { getPaymentGateway } from "./payments/registry";
import {
  cancelGatewayPayment,
  ensureSubaccountWebhook,
  expireDueOnlinePayments,
  refreshGatewayIfNeeded,
  subaccountKeyOf,
  syncGatewayFees,
} from "./gatewayAccountBackend";
import {
  createSubAccount,
  getSubaccountBalance,
  createTransfer,
  listTransfers,
  receiveInCash,
} from "@/lib/asaas";
import { requireSameOrganization, requireTenant } from "./server/tenant";
import { mapRowToOnlinePayment } from "./onlinePaymentsRows";
import { brazilNationalDigits } from "@gestarahub/core/phone";
import { CURRENT_SUBACCOUNT_TERMS_VERSION } from "@gestarahub/contracts";



export async function insertOnlinePaymentInDb(
  payment: OnlinePayment,
  clientId?: string,
): Promise<OnlinePayment> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("online_payments")
    .insert({
      id: payment.id,
      organization_id: payment.organizationId,
      charge_id: payment.chargeId,
      client_id: clientId ?? null,
      method: payment.method,
      status: payment.status,
      amount_cents: payment.amountCents,
      split_amount_cents: payment.splitAmountCents ?? 0,
      gateway_fee_cents: payment.gatewayFeeCents ?? 0,
      net_amount_cents: payment.netAmountCents ?? payment.amountCents,
      gateway_provider: payment.gatewayProvider ?? "asaas",
      gateway_payment_id: payment.gatewayPaymentId ?? null,
      pix_copy_paste: payment.pixCopyPaste ?? null,
      link_url: payment.linkUrl ?? null,
      public_code: payment.publicCode ?? null,
      fee_passed_to_customer: Boolean(payment.feePassedToCustomer),
      expires_at: payment.expiresAt,
      paid_at: payment.paidAt ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error(
      "[onlinePaymentsBackend] Erro ao inserir pagamento online:",
      error,
    );
    throw new Error("Erro ao registrar pagamento online no banco de dados.");
  }

  return mapRowToOnlinePayment(data);
}

export async function listOnlinePaymentsForChargeFromDb(
  chargeId: Id,
  organizationId: string,
): Promise<OnlinePayment[]> {
  const client = await getClientForTenant();
  // A modal Cobrar online mostra o codigo em aberto: o vencido expira antes (e sai do Asaas).
  await expireDueOnlinePayments(organizationId).catch((err) =>
    console.error("[listOnlinePaymentsForChargeFromDb] Erro ao expirar cobranças vencidas:", err),
  );
  const { data, error } = await client
    .from("online_payments")
    .select("*")
    .eq("charge_id", chargeId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(
      "[onlinePaymentsBackend] Erro ao listar pagamentos da cobrança:",
      error,
    );
    return [];
  }

  return (data || []).map(mapRowToOnlinePayment);
}


/**
 * Simula a liquidação de um pagamento online no Sandbox/banco local.
 * Marca o online_payment e a cobrança correspondente como pagos no Supabase,
 * e notifica o Asaas via receiveInCash caso esteja em ambiente de testes.
 */
export async function simulateOnlinePaidAction(
  onlinePaymentId: string,
): Promise<{ payment: OnlinePayment; chargeId: string } | null> {
  const ctx = await requireTenant();
  ctx.require("billing:manage");
  const adminClient = createSupabaseAdminClient();

  // 1. Busca o pagamento online pelo ID
  const { data: row, error: fetchErr } = await adminClient
    .from("online_payments")
    .select("*")
    .eq("id", onlinePaymentId)
    .maybeSingle();

  if (row && row.organization_id !== ctx.organizationId) throw forbiddenError();
  if (fetchErr || !row) {
    console.error(
      "[simulateOnlinePaidAction] Pagamento online não encontrado:",
      onlinePaymentId,
      fetchErr,
    );
    return null;
  }

  const paidAtISO = new Date().toISOString();

  // 2. Atualiza o status para pago
  const { data: updatedPayment, error: paymentError } = await adminClient
    .from("online_payments")
    .update({
      status: "paid",
      paid_at: paidAtISO,
    })
    .eq("id", row.id)
    .select()
    .maybeSingle();

  if (paymentError || !updatedPayment) {
    console.error(
      "[simulateOnlinePaidAction] Erro ao atualizar status do online_payment:",
      paymentError,
    );
    return null;
  }

  // 3. Cancela outros pagamentos da mesma cobrança ainda em aberto
  await adminClient
    .from("online_payments")
    .update({ status: "canceled", canceled_reason: "Pago por outro código" })
    .eq("charge_id", row.charge_id)
    .neq("id", row.id)
    .eq("status", "awaiting");

  // 4. Atualiza a cobrança para paga
  const method = row.method === "link" ? "card" : "pix";
  const { error: chargeError } = await adminClient
    .from("charges")
    .update({
      status: "paid",
      method,
      paid_via: "online",
      paid_at: paidAtISO,
    })
    .eq("id", row.charge_id);

  if (chargeError) {
    console.error(
      "[simulateOnlinePaidAction] Erro ao atualizar charge após simulação:",
      chargeError,
    );
  }

  // 5. Se for Asaas Sandbox e tiver gateway_payment_id, liquida no gateway também
  if (row.gateway_payment_id && row.gateway_provider === "asaas") {
    try {
      const { data: charge } = await adminClient
        .from("charges")
        .select("organization_id")
        .eq("id", row.charge_id)
        .maybeSingle();

      let subaccountApiKey: string | undefined;
      if (charge?.organization_id) {
        const { data: org } = await adminClient
          .from("organizations")
          .select("gateway_api_key")
          .eq("id", charge.organization_id)
          .maybeSingle();
        subaccountApiKey = org?.gateway_api_key;
      }

      const todayDate = paidAtISO.split("T")[0];
      await receiveInCash(
        String(row.gateway_payment_id),
        todayDate,
        (Number(row.amount_cents) || 0) / 100,
        subaccountApiKey,
      );
      console.log(
        `[simulateOnlinePaidAction] Baixa confirmada no Asaas Sandbox para o pagamento ${row.gateway_payment_id}!`,
      );
    } catch (asaasErr) {
      console.warn(
        "[simulateOnlinePaidAction] Não foi possível liquidar no Asaas Sandbox (ignorado):",
        asaasErr,
      );
    }
  }

  const payment = mapRowToOnlinePayment(updatedPayment);
  return { payment, chargeId: String(row.charge_id) };
}

export async function cancelOnlinePaymentsForChargeInDb(
  chargeId: Id,
  organizationId: string,
  reason?: string,
): Promise<void> {
  const client = await getClientForTenant();
  const { data: rows } = await client
    .from("online_payments")
    .select("id, gateway_provider, gateway_payment_id")
    .eq("charge_id", chargeId)
    .eq("organization_id", organizationId)
    .eq("status", "awaiting");
  if (!rows?.length) return;

  // Cancela tambem no Asaas, senao o aluno ainda paga o link ou o QR antigo.
  const key = rows.some((r) => r.gateway_provider === "asaas") ? await subaccountKeyOf(organizationId) : null;
  const toCancel: string[] = [];
  const pendingAtGateway: string[] = [];
  for (const row of rows) {
    if (row.gateway_provider === "asaas" && row.gateway_payment_id && key) {
      const result = await cancelGatewayPayment(String(row.gateway_payment_id), key);
      // Ja paga no Asaas: nao cancela aqui; o webhook de pagamento da a baixa.
      if (result === "paid") continue;
      if (result === "failed") pendingAtGateway.push(String(row.id));
    }
    toCancel.push(String(row.id));
  }
  if (toCancel.length === 0) return;

  const updatePayload: Record<string, unknown> = { status: "canceled" };
  if (reason) updatePayload.canceled_reason = reason;
  await client.from("online_payments").update(updatePayload).in("id", toCancel);
  // Falhou no Asaas: cancela aqui mesmo assim e marca para tentar de novo.
  if (pendingAtGateway.length > 0) {
    await client.from("online_payments").update({ gateway_cancel_pending: true }).in("id", pendingAtGateway);
  }
}

export interface SetupSubaccountInput {
  organizationId: string;
  name: string;
  email: string;
  cpfCnpj: string;
  /** Obrigatoria para CPF (AAAA-MM-DD). */
  birthDate?: string;
  /** So para CNPJ. */
  companyType?: "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";
  mobilePhone?: string;
  /** Renda ou faturamento mensal, em reais. */
  incomeValue?: number;
  address?: string;
  addressNumber?: string;
  complement?: string;
  /** Bairro. */
  province?: string;
  postalCode?: string;
}

/**
 * Campos que o Asaas exige para criar a subconta (POST /v3/accounts). Confere
 * antes de chamar, para responder em portugues e sem gastar a chamada.
 */
function missingSubaccountField(input: SetupSubaccountInput, isCnpj: boolean): string | null {
  if (!isCnpj && !/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate ?? "")) return "Informe a data de nascimento.";
  if (!brazilNationalDigits(input.mobilePhone)) return "Informe um celular do Brasil com DDD.";
  if (!input.incomeValue || input.incomeValue <= 0) return "Informe a renda ou o faturamento mensal.";
  if ((input.postalCode ?? "").replace(/\D/g, "").length !== 8) return "Informe o CEP.";
  if (!input.address?.trim()) return "Informe a rua do endereço.";
  if (!input.addressNumber?.trim()) return "Informe o número do endereço.";
  if (!input.province?.trim()) return "Informe o bairro do endereço.";
  return null;
}

export interface SetupSubaccountResult {
  success: boolean;
  accountId?: string;
  walletId?: string;
  status?: string;
  error?: string;
}

/**
 * Server Action para ativar a subconta de recebimentos da academia no gateway.
 * Cria a conta filha no Asaas com split automático para a Master Account.
 */
export async function setupSubaccountAction(
  input: SetupSubaccountInput,
): Promise<SetupSubaccountResult> {
  await requireSameOrganization(input.organizationId, { profiles: ["owner"] });
  const adminClient = createSupabaseAdminClient();

  try {
    const cleanCpfCnpj = input.cpfCnpj.replace(/\D/g, "");
    const isCnpj = cleanCpfCnpj.length > 11;
    // Tipo de empresa so vale para CNPJ.
    const companyType = isCnpj ? input.companyType || "LIMITED" : undefined;
    const missing = missingSubaccountField(input, isCnpj);
    if (missing) return { success: false, error: missing };

    let accountId = "";
    let walletId = "";
    let apiKey = "";

    if (process.env.ASAAS_API_KEY) {
      const res = await createSubAccount({
        name: input.name,
        email: input.email,
        cpfCnpj: cleanCpfCnpj,
        companyType,
        birthDate: isCnpj ? undefined : input.birthDate,
        mobilePhone: brazilNationalDigits(input.mobilePhone),
        incomeValue: input.incomeValue,
        address: input.address?.trim(),
        addressNumber: input.addressNumber?.trim(),
        complement: input.complement?.trim() || undefined,
        province: input.province?.trim(),
        postalCode: input.postalCode?.replace(/\D/g, ""),
      });

      accountId = res.id;
      walletId = res.walletId;
      apiKey = res.apiKey ?? res.accessToken?.apiKey ?? "";
      if (!apiKey) {
        console.error("[setupSubaccountAction] Subconta criada sem chave de API na resposta:", accountId);
      }
    } else {
      // Mock mode fallback
      accountId = `mock_acc_${Date.now()}`;
      walletId = `mock_wallet_${Date.now()}`;
      apiKey = `mock_key_${Date.now()}`;
    }

    // 1. Atualiza as colunas de gateway da organização
    const { error: orgError } = await adminClient
      .from("organizations")
      .update({
        gateway_provider: "asaas",
        gateway_account_id: accountId,
        gateway_wallet_id: walletId,
        gateway_api_key: apiKey,
        gateway_status: "approved",
      })
      .eq("id", input.organizationId);

    if (orgError) {
      console.error(
        "[setupSubaccountAction] Erro ao gravar subconta na organização:",
        orgError,
      );
      return {
        success: false,
        error: "Erro ao salvar os dados da subconta no banco de dados.",
      };
    }

    // 2. Atualiza settings.onlinePayments da organização
    const { data: orgData } = await adminClient
      .from("organizations")
      .select("settings")
      .eq("id", input.organizationId)
      .maybeSingle();

    const currentSettings = (orgData?.settings as Record<string, unknown>) || {};
    const currentOnline =
      (currentSettings.onlinePayments as Record<string, unknown>) || {};

    await adminClient
      .from("organizations")
      .update({
        settings: {
          ...currentSettings,
          onlinePayments: {
            ...currentOnline,
            enabled: true,
            gatewayProvider: "asaas",
            gatewayAccountId: accountId,
            gatewayWalletId: walletId,
            gatewayStatus: "approved",
            termsAcceptedAt: new Date().toISOString(),
            termsVersion: CURRENT_SUBACCOUNT_TERMS_VERSION,
          },
        },
      })
      .eq("id", input.organizationId);

    // 3. Subconta aprovada: tarifas dela e webhook de baixa automatica (doc 19, secao 4).
    //    Falha aqui nao desfaz a ativacao: as tarifas voltam a ser buscadas no uso
    //    e o webhook e recadastrado quando a URL estiver configurada.
    if (process.env.ASAAS_API_KEY) {
      await syncGatewayFees(input.organizationId);
      await ensureSubaccountWebhook(input.organizationId);
    }

    // 4. Registra auditoria jurídica de consentimento (LGPD, Marco Civil, Bacen)
    try {
      const headerList = await headers();
      const rawIp =
        headerList.get("x-forwarded-for") ||
        headerList.get("x-real-ip") ||
        "127.0.0.1";
      const ipAddress = rawIp.split(",")[0].trim();
      const userAgent = headerList.get("user-agent") || "unknown";
      const currentUser = await getCurrentUser();

      if (currentUser?.id) {
        await adminClient.from("legal_consents").insert({
          organization_id: input.organizationId,
          user_id: currentUser.id,
          consent_type: "subaccount_brokerage",
          terms_version: CURRENT_SUBACCOUNT_TERMS_VERSION,
          ip_address: ipAddress,
          user_agent: userAgent,
          metadata: {
            accountId,
            walletId,
            companyType,
            titularName: input.name,
            financeEmail: input.email,
            cpfCnpjMasked:
              cleanCpfCnpj.length === 11
                ? `***.${cleanCpfCnpj.slice(3, 6)}.${cleanCpfCnpj.slice(6, 9)}-**`
                : `**.***.${cleanCpfCnpj.slice(5, 8)}/${cleanCpfCnpj.slice(8, 12)}-**`,
          },
        });
      }
    } catch (consentErr) {
      console.error(
        "[setupSubaccountAction] Erro ao registrar consentimento legal:",
        consentErr,
      );
    }

    return {
      success: true,
      accountId,
      walletId,
      status: "approved",
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Erro ao processar ativação de subconta.";
    console.error("[setupSubaccountAction] Erro:", err);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/** As tarifas vivem na coluna gateway_fees; nunca dentro de settings. */
function stripGatewayFees<T extends Record<string, unknown>>(online: T): T {
  return Object.fromEntries(Object.entries(online).filter(([key]) => key !== "gatewayFees")) as T;
}

/**
 * Consulta o status do gateway da organização no banco de dados.
 */
export async function getOrganizationGatewayAction(organizationId: string) {
  await requireSameOrganization(organizationId);
  const adminClient = createSupabaseAdminClient();
  const { data } = await adminClient
    .from("organizations")
    .select(
      "id, gateway_provider, gateway_account_id, gateway_wallet_id, gateway_status, gateway_api_key, gateway_fees, gateway_webhook_url, settings, subscription",
    )
    .eq("id", organizationId)
    .maybeSingle();

  // Tarifas com mais de 24 horas e webhook com URL antiga: atualiza depois da resposta.
  if (data) {
    after(() =>
      refreshGatewayIfNeeded(data).catch((err) =>
        console.error("[getOrganizationGatewayAction] Erro ao atualizar a subconta:", err),
      ),
    );
  }

  return {
    gatewayFees: (data?.gateway_fees as OnlinePaymentSettings["gatewayFees"]) ?? undefined,
    provider: data?.gateway_provider || "asaas",
    accountId: data?.gateway_account_id || undefined,
    walletId: data?.gateway_wallet_id || undefined,
    status: data?.gateway_status || "not_configured",
    settings: (data?.settings as Record<string, unknown>) || {},
    subscription: (data?.subscription as Record<string, unknown>) || undefined,
  };
}

/**
 * Atualiza as configurações de cobrança online da organização no Supabase.
 */
export async function updateOrganizationOnlineSettingsAction(
  organizationId: string,
  updates: Partial<OnlinePaymentSettings>,
): Promise<boolean> {
  await requireSameOrganization(organizationId, { permissions: ["finance:manage"] });
  try {
    const adminClient = createSupabaseAdminClient();
    const { data: orgData } = await adminClient
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();

    const currentSettings = (orgData?.settings as Record<string, unknown>) || {};
    const currentOnline =
      (currentSettings.onlinePayments as Record<string, unknown>) || {};

    const { error } = await adminClient
      .from("organizations")
      .update({
        settings: {
          ...currentSettings,
          onlinePayments: stripGatewayFees({
            ...currentOnline,
            ...updates,
          }),
        },
      })
      .eq("id", organizationId);

    if (error) {
      console.error(
        "[updateOrganizationOnlineSettingsAction] Erro ao atualizar settings:",
        error,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      "[updateOrganizationOnlineSettingsAction] Exceção ao atualizar settings:",
      err,
    );
    return false;
  }
}

/**
 * Server Action agnóstica para criação de Pix online via gateway ativo.
 * Recupera de forma segura a subconta da organização e aplica a taxa de split correta.
 */
export async function createOnlinePixPaymentAction(
  input: CreatePixInput,
  provider?: string,
): Promise<PixPayment | { error: string }> {
  const ctx = await requireTenant();
  try {
    let subaccountApiKey = input.subaccountApiKey;
    let splitAmountCents = input.splitAmountCents;
    let enrichedInput = { ...input };
    // A cobranca da demonstracao nao esta no banco; a consulta nao pode derrubar a chamada ao gateway.
    try {

    // Se subaccountApiKey não foi fornecida, busca do tenant no banco
    if (input.chargeId) {
      const adminClient = createSupabaseAdminClient();
      const { data: charge } = await adminClient
        .from("charges")
        .select("organization_id, due_date, competence, kind, description")
        .eq("id", input.chargeId)
        .maybeSingle();

      if (charge && charge.organization_id !== ctx.organizationId) {
        return { error: "Cobrança de outro espaço." };
      }
      if (charge) {
        enrichedInput = {
          ...enrichedInput,
          chargeDueDate: enrichedInput.chargeDueDate || charge.due_date,
          competence: enrichedInput.competence || charge.competence,
          chargeKind: enrichedInput.chargeKind || charge.kind,
          description: enrichedInput.description || charge.description,
        };
      }

      if (charge?.organization_id) {
        const { data: org } = await adminClient
          .from("organizations")
          .select("gateway_api_key, subscription")
          .eq("id", charge.organization_id)
          .maybeSingle();

        if (org?.gateway_api_key) {
          subaccountApiKey = org.gateway_api_key;
        }

        // Determina o valor do split com base no plano (Pro = R$ 1,29, Free = R$ 1,99)
        if (splitAmountCents === undefined) {
          const tier = (org?.subscription as Record<string, unknown>)?.tier;
          splitAmountCents = tier === "pro" || tier === "scale" ? 129 : 199;
        }
      }
    }

    } catch (lookupError) {
      console.warn("[createOnlinePixPaymentAction] Cobrança não encontrada no banco; segue com a chave principal:", lookupError);
    }

    const gateway = getPaymentGateway(provider);
    const result = await gateway.createPix({
      ...enrichedInput,
      subaccountApiKey,
      splitAmountCents: splitAmountCents ?? 199,
    });
    if (gateway.provider === "mock") {
      return {
        ...result,
        provider: "mock",
        fallbackReason: process.env.ASAAS_API_KEY
          ? "Provedor de demonstração selecionado no servidor."
          : "ASAAS_API_KEY não configurada no servidor.",
      };
    }
    return { ...result, provider: gateway.provider };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[createOnlinePixPaymentAction] Erro ao gerar Pix no gateway:", error);
    return { error: message };
  }
}

/**
 * Server Action agnóstica para criação de link de pagamento via gateway ativo.
 */
export async function createOnlineLinkPaymentAction(
  input: CreateLinkInput,
  provider?: string,
): Promise<PaymentLinkPayment | { error: string }> {
  const ctx = await requireTenant();
  try {
    let subaccountApiKey = input.subaccountApiKey;
    let splitAmountCents = input.splitAmountCents;
    let enrichedInput = { ...input };
    // A cobranca da demonstracao nao esta no banco; a consulta nao pode derrubar a chamada ao gateway.
    try {

    if (input.chargeId) {
      const adminClient = createSupabaseAdminClient();
      const { data: charge } = await adminClient
        .from("charges")
        .select("organization_id, due_date, competence, kind, description")
        .eq("id", input.chargeId)
        .maybeSingle();

      if (charge && charge.organization_id !== ctx.organizationId) {
        return { error: "Cobrança de outro espaço." };
      }
      if (charge) {
        enrichedInput = {
          ...enrichedInput,
          chargeDueDate: enrichedInput.chargeDueDate || charge.due_date,
          competence: enrichedInput.competence || charge.competence,
          chargeKind: enrichedInput.chargeKind || charge.kind,
          description: enrichedInput.description || charge.description,
        };
      }

      if (charge?.organization_id) {
        const { data: org } = await adminClient
          .from("organizations")
          .select("gateway_api_key, subscription")
          .eq("id", charge.organization_id)
          .maybeSingle();

        if (org?.gateway_api_key) {
          subaccountApiKey = org.gateway_api_key;
        }

        // Determina o valor do split com base no plano (Pro = R$ 1,29, Free = R$ 1,99)
        if (splitAmountCents === undefined) {
          const tier = (org?.subscription as Record<string, unknown>)?.tier;
          splitAmountCents = tier === "pro" || tier === "scale" ? 129 : 199;
        }
      }
    }

    } catch (lookupError) {
      console.warn("[createOnlineLinkPaymentAction] Cobrança não encontrada no banco; segue com a chave principal:", lookupError);
    }

    const gateway = getPaymentGateway(provider);
    const result = await gateway.createLink({
      ...enrichedInput,
      subaccountApiKey,
      splitAmountCents: splitAmountCents ?? 199,
    });
    if (gateway.provider === "mock") {
      return {
        ...result,
        provider: "mock",
        fallbackReason: process.env.ASAAS_API_KEY
          ? "Provedor de demonstração selecionado no servidor."
          : "ASAAS_API_KEY não configurada no servidor.",
      };
    }
    return { ...result, provider: gateway.provider };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[createOnlineLinkPaymentAction] Erro ao gerar Link no gateway:", error);
    return { error: message };
  }
}

function detectPixKeyType(
  key: string,
): "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP" {
  const clean = key.trim();
  if (clean.includes("@")) return "EMAIL";
  const digits = clean.replace(/\D/g, "");
  if (digits.length === 11) {
    if (clean.startsWith("+") || clean.includes("(") || clean.includes(")")) {
      return "PHONE";
    }
    return "CPF";
  }
  if (digits.length === 14) return "CNPJ";
  return "EVP";
}

export interface SubaccountBalanceResult {
  balanceCents: number;
  /** Pago e ainda nao liberado (cartao), do banco do GestaraHub. */
  awaitingCents: number;
  /** Proximo dia em que algum valor a liberar fica disponivel. */
  nextCreditDate?: string;
  availableForTransferCents: number;
}

/**
 * A liberar: pagos pelo aluno com o saldo ainda nao disponivel (PAYMENT_CONFIRMED
 * sem o RECEIVED). O saldo do Asaas (`GET /finance/balance`) so traz o disponivel.
 */
async function pendingRelease(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  organizationId: string,
): Promise<{ awaitingCents: number; nextCreditDate?: string }> {
  const { data } = await adminClient
    .from("online_payments")
    .select("net_amount_cents, credit_date")
    .eq("organization_id", organizationId)
    .eq("status", "paid")
    .eq("funds_released", false);
  const rows = data ?? [];
  const dates = rows.map((r) => (r.credit_date ? String(r.credit_date).slice(0, 10) : "")).filter(Boolean).sort();
  return {
    awaitingCents: rows.reduce((total, r) => total + (Number(r.net_amount_cents) || 0), 0),
    nextCreditDate: dates[0],
  };
}

/**
 * Consulta o saldo financeiro da subconta na Asaas ou fallback local.
 */
export async function getSubaccountBalanceAction(
  organizationId: string,
): Promise<SubaccountBalanceResult> {
  await requireSameOrganization(organizationId, { permissions: ["finance:view"] });
  const adminClient = createSupabaseAdminClient();
  const { data: org } = await adminClient
    .from("organizations")
    .select("gateway_api_key")
    .eq("id", organizationId)
    .maybeSingle();

  const pending = await pendingRelease(adminClient, organizationId);

  if (org?.gateway_api_key && process.env.ASAAS_API_KEY) {
    try {
      const res = await getSubaccountBalance(org.gateway_api_key);
      const balanceCents = Math.round((res.balance || 0) * 100);
      return {
        balanceCents,
        ...pending,
        availableForTransferCents: Math.max(0, balanceCents),
      };
    } catch (err) {
      console.error("[getSubaccountBalanceAction] Erro no Asaas:", err);
    }
  }

  // Fallback: calcula a partir dos pagamentos online pagos no banco
  const { data: payments } = await adminClient
    .from("online_payments")
    .select("net_amount_cents, status")
    .eq("organization_id", organizationId)
    .eq("status", "paid")
    .eq("funds_released", true);

  const totalNet = (payments || []).reduce(
    (acc, p) => acc + (p.net_amount_cents || 0),
    0,
  );

  return {
    balanceCents: totalNet,
    ...pending,
    availableForTransferCents: totalNet,
  };
}

export interface TransferActionResult {
  success: boolean;
  transferId?: string;
  status?: string;
  error?: string;
}

/**
 * Realiza transferência via Pix do saldo da subconta para a chave Pix do titular.
 */
export async function requestSubaccountTransferAction(input: {
  organizationId: string;
  amountCents: number;
  pixKey: string;
}): Promise<TransferActionResult> {
  // Tirar dinheiro da subconta: so o dono do espaco.
  await requireSameOrganization(input.organizationId, { profiles: ["owner"] });
  if (input.amountCents <= 0) {
    return { success: false, error: "O valor deve ser maior que zero." };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: org } = await adminClient
    .from("organizations")
    .select("gateway_api_key")
    .eq("id", input.organizationId)
    .maybeSingle();

  if (org?.gateway_api_key && process.env.ASAAS_API_KEY) {
    try {
      const keyType = detectPixKeyType(input.pixKey);
      const res = await createTransfer(
        {
          value: input.amountCents / 100,
          operationType: "PIX",
          pixAddressKey: input.pixKey.trim(),
          pixAddressKeyType: keyType,
          description: "Saque GestaraHub",
        },
        org.gateway_api_key,
      );

      return {
        success: true,
        transferId: res.id,
        status: res.status,
      };
    } catch (err: unknown) {
      console.error("[requestSubaccountTransferAction] Erro no Asaas:", err);
      const msg =
        err instanceof Error ? err.message : "Erro ao realizar transferência.";
      return { success: false, error: msg };
    }
  }

  // Mock transfer
  return {
    success: true,
    transferId: `mock_tr_${Date.now()}`,
    status: "DONE",
  };
}

export interface SubaccountTransferItem {
  id: string;
  dateCreated: string;
  valueCents: number;
  status: string;
  receiptUrl?: string;
}

/**
 * Lista as transferências realizadas na subconta.
 */
export async function listSubaccountTransfersAction(
  organizationId: string,
): Promise<SubaccountTransferItem[]> {
  await requireSameOrganization(organizationId, { permissions: ["finance:view"] });
  const adminClient = createSupabaseAdminClient();
  const { data: org } = await adminClient
    .from("organizations")
    .select("gateway_api_key")
    .eq("id", organizationId)
    .maybeSingle();

  if (org?.gateway_api_key && process.env.ASAAS_API_KEY) {
    try {
      const res = await listTransfers(org.gateway_api_key);
      return (res.data || []).map((t) => ({
        id: t.id,
        dateCreated: t.dateCreated,
        valueCents: Math.round(t.value * 100),
        status: t.status,
        receiptUrl: t.transactionReceiptUrl,
      }));
    } catch (err) {
      console.error("[listSubaccountTransfersAction] Erro no Asaas:", err);
    }
  }

  return [];
}

export interface SubaccountReceiptItem {
  id: string;
  chargeId: string;
  method: string;
  status: string;
  amountCents: number;
  splitAmountCents: number;
  /** Tarifa do Asaas: real depois do pagamento (webhook), estimada antes. */
  gatewayFeeCents: number;
  /** Meio usado pelo aluno, quando o Asaas informou. */
  paidMethod?: OnlinePayment["paidMethod"];
  netAmountCents: number;
  feePassedToCustomer?: boolean;
  paidAt?: string;
  createdAt: string;
  canceledReason?: string;
  /** Dia em que o valor fica (ou ficou) disponivel para saque. */
  creditDate?: string;
  /** Pago e ja disponivel; pago e false = a liberar (cartao). */
  fundsReleased: boolean;
}

/** Situacao no filtro do historico. "open" = pagas e aguardando (padrao). */
export type ReceiptStatusFilter = "open" | "paid" | "awaiting" | "canceled" | "all";

export interface SubaccountReceiptsQuery {
  organizationId: string;
  /**
   * Periodo "AAAA-MM-DD" (inclusive, horario de Brasilia), pela data do
   * pagamento ou, se nao pago, da criacao. Sem `from` e `to`: todo o periodo.
   */
  from?: string;
  to?: string;
  status: ReceiptStatusFilter;
  method: "all" | OnlinePayment["method"];
  page: number;
  pageSize: number;
}

export interface SubaccountReceiptsSummary {
  count: number;
  /** So os pagos: o que os alunos pagaram, as taxas e o que entrou. */
  paidCount: number;
  grossCents: number;
  feeCents: number;
  netCents: number;
  /** Do liquido pago: o que ja esta disponivel e o que ainda vai liberar. */
  releasedNetCents: number;
  pendingNetCents: number;
}

export interface SubaccountReceiptsPage {
  items: SubaccountReceiptItem[];
  total: number;
  summary: SubaccountReceiptsSummary;
}

const STATUS_FILTER_VALUES: Record<ReceiptStatusFilter, string[] | null> = {
  open: ["paid", "awaiting"],
  paid: ["paid"],
  awaiting: ["awaiting"],
  canceled: ["canceled", "expired"],
  all: null,
};

/** Dia "AAAA-MM-DD" no horario de Brasilia: inicio, em ISO UTC. */
function startOfDayInBrazil(date: string): string {
  return new Date(`${date}T00:00:00-03:00`).toISOString();
}

/** Dia seguinte a "AAAA-MM-DD" (fim exclusivo do intervalo). */
function nextDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Historico de movimentacoes da subconta (Recebimentos online), filtrado no
 * banco: mes, situacao e forma, com paginacao e os totais do filtro. Le com o
 * cliente do usuario (RLS da organizacao), nao com a chave de servico.
 */
export async function listSubaccountReceiptsAction(
  query: SubaccountReceiptsQuery,
): Promise<SubaccountReceiptsPage> {
  const client = await getClientForTenant();
  // Vencidas pela validade: expira aqui e exclui no Asaas antes de listar.
  await expireDueOnlinePayments(query.organizationId).catch((err) =>
    console.error("[listSubaccountReceiptsAction] Erro ao expirar cobranças vencidas:", err),
  );
  const statuses = STATUS_FILTER_VALUES[query.status];

  // Mesmo filtro para a pagina e para os totais.
  // Intervalo aberto de um lado tambem vale (so "de" ou so "ate").
  let period: string | null = null;
  if (query.from || query.to) {
    const from = query.from ? startOfDayInBrazil(query.from) : null;
    const to = query.to ? startOfDayInBrazil(nextDay(query.to)) : null;
    const on = (col: string) =>
      [from ? `${col}.gte.${from}` : null, to ? `${col}.lt.${to}` : null].filter(Boolean).join(",");
    period = `and(${on("paid_at")}),and(paid_at.is.null,${on("created_at")})`;
  }
  const offset = (query.page - 1) * query.pageSize;

  let pageQuery = client
    .from("online_payments")
    .select(
      `
      id, charge_id, method, status, amount_cents, split_amount_cents, gateway_fee_cents, paid_method, net_amount_cents, fee_passed_to_customer, paid_at, created_at, canceled_reason, credit_date, funds_released,
      charges (
        status, paid_via
      )
      `,
      { count: "exact" },
    )
    .eq("organization_id", query.organizationId);
  let totalsQuery = client
    .from("online_payments")
    .select("status, amount_cents, split_amount_cents, gateway_fee_cents, net_amount_cents, funds_released")
    .eq("organization_id", query.organizationId);
  if (period) {
    pageQuery = pageQuery.or(period);
    totalsQuery = totalsQuery.or(period);
  }
  if (statuses) {
    pageQuery = pageQuery.in("status", statuses);
    totalsQuery = totalsQuery.in("status", statuses);
  }
  if (query.method !== "all") {
    pageQuery = pageQuery.eq("method", query.method);
    totalsQuery = totalsQuery.eq("method", query.method);
  }

  const [pageRes, totalsRes] = await Promise.all([
    pageQuery.order("created_at", { ascending: false }).range(offset, offset + query.pageSize - 1),
    totalsQuery,
  ]);

  const empty: SubaccountReceiptsPage = {
    items: [],
    total: 0,
    summary: { count: 0, paidCount: 0, grossCents: 0, feeCents: 0, netCents: 0, releasedNetCents: 0, pendingNetCents: 0 },
  };
  if (pageRes.error || !pageRes.data) {
    console.error("[listSubaccountReceiptsAction] Erro ao listar recebimentos:", pageRes.error);
    return empty;
  }

  const summary = (totalsRes.data ?? []).reduce<SubaccountReceiptsSummary>(
    (acc, r) => {
      acc.count += 1;
      if (r.status === "paid") {
        acc.paidCount += 1;
        acc.grossCents += Number(r.amount_cents) || 0;
        acc.feeCents += (Number(r.gateway_fee_cents) || 0) + (Number(r.split_amount_cents) || 0);
        acc.netCents += Number(r.net_amount_cents) || 0;
        if (r.funds_released) acc.releasedNetCents += Number(r.net_amount_cents) || 0;
        else acc.pendingNetCents += Number(r.net_amount_cents) || 0;
      }
      return acc;
    },
    { ...empty.summary },
  );

  const items = pageRes.data.map((r) => {
    const charge = Array.isArray(r.charges) ? r.charges[0] : (r.charges as { status?: string; paid_via?: string } | null);
    let canceledReason = r.canceled_reason ? String(r.canceled_reason) : undefined;
    if (String(r.status) === "canceled" && !canceledReason) {
      if (charge?.status === "paid") {
        canceledReason = charge.paid_via === "manual" ? "Baixa manual da cobrança" : "Pago por outro código";
      } else if (charge?.status === "canceled") {
        canceledReason = "Cobrança cancelada";
      } else {
        canceledReason = "Substituído por novo código";
      }
    }

    return {
      id: String(r.id),
      chargeId: String(r.charge_id),
      method: String(r.method),
      status: String(r.status),
      amountCents: Number(r.amount_cents) || 0,
      splitAmountCents: Number(r.split_amount_cents) || 0,
      gatewayFeeCents: Number(r.gateway_fee_cents) || 0,
      paidMethod: (r.paid_method as SubaccountReceiptItem["paidMethod"]) ?? undefined,
      netAmountCents: Number(r.net_amount_cents) || 0,
      feePassedToCustomer: Boolean(r.fee_passed_to_customer),
      paidAt: r.paid_at ? String(r.paid_at) : undefined,
      createdAt: String(r.created_at),
      canceledReason,
      creditDate: r.credit_date ? String(r.credit_date).slice(0, 10) : undefined,
      fundsReleased: Boolean(r.funds_released),
    };
  });

  return { items, total: pageRes.count ?? items.length, summary };
}

/**
 * Depois de o servidor gravar o cancelamento dos codigos (doc 15, fatia 2),
 * cancela tambem no Asaas. O espaco vem da sessao e as linhas sao lidas com o
 * RLS dela. Ja pago no Asaas fica para o webhook dar a baixa; falha no Asaas
 * marca para tentar de novo.
 */
export async function cancelGatewayPaymentsAction(paymentIds: Id[]): Promise<void> {
  if (paymentIds.length === 0) return;
  const { requireTenant } = await import("./server/tenant");
  const ctx = await requireTenant();
  const { data: rows } = await ctx.client
    .from("online_payments")
    .select("id, gateway_provider, gateway_payment_id")
    .eq("organization_id", ctx.organizationId)
    .in("id", paymentIds);
  const asaasRows = (rows ?? []).filter((r) => r.gateway_provider === "asaas" && r.gateway_payment_id);
  if (asaasRows.length === 0) return;
  const key = await subaccountKeyOf(ctx.organizationId);
  if (!key) return;
  const pending: string[] = [];
  for (const row of asaasRows) {
    const result = await cancelGatewayPayment(String(row.gateway_payment_id), key);
    if (result === "failed") pending.push(String(row.id));
  }
  if (pending.length > 0) {
    await createSupabaseAdminClient()
      .from("online_payments")
      .update({ gateway_cancel_pending: true })
      .eq("organization_id", ctx.organizationId)
      .in("id", pending);
  }
}
