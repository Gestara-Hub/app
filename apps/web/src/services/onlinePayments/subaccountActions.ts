"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import type { OnlinePaymentSettings } from "@gestarahub/contracts";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureSubaccountWebhook, refreshGatewayIfNeeded, syncGatewayFees } from "./gateway";
import { createSubAccount } from "@/lib/asaas";
import { requireSameOrganization } from "../server/tenant";
import { brazilNationalDigits } from "@gestarahub/core/phone";
import { CURRENT_SUBACCOUNT_TERMS_VERSION } from "@gestarahub/contracts";
import { logError } from "@/lib/log";

/**
 * Subconta do espaco no parceiro: abertura, status e configuracao de Recebimentos online.
 */

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
        logError("[setupSubaccountAction] Subconta criada sem chave de API na resposta:", accountId);
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
      logError(
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
      logError(
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
    logError("[setupSubaccountAction] Erro:", err);
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
        logError("[getOrganizationGatewayAction] Erro ao atualizar a subconta:", err),
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
      logError(
        "[updateOrganizationOnlineSettingsAction] Erro ao atualizar settings:",
        error,
      );
      return false;
    }
    return true;
  } catch (err) {
    logError(
      "[updateOrganizationOnlineSettingsAction] Exceção ao atualizar settings:",
      err,
    );
    return false;
  }
}
