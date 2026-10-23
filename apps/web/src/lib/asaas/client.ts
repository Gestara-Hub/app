import type {
  AsaasAccountRequest,
  AsaasWebhookConfig,
  AsaasWebhookResponse,
  AsaasAccountResponse,
  AsaasCustomerRequest,
  AsaasCustomerResponse,
  AsaasPaymentRequest,
  AsaasPaymentResponse,
  AsaasPixQrCodeResponse,
  AsaasBalanceResponse,
  AsaasTransferRequest,
  AsaasTransferResponse,
  AsaasSubscriptionRequest,
  AsaasSubscriptionResponse,
} from "./types";
import { logError, logWarn } from "@/lib/log";

export interface AsaasConfig {
  apiUrl: string;
  masterApiKey: string;
  masterWalletId?: string;
}

export function getAsaasConfig(): AsaasConfig {
  const apiUrl =
    process.env.ASAAS_API_URL || "https://sandbox.asaas.com/api/v3";
  const rawKey = process.env.ASAAS_API_KEY || "";
  const masterApiKey = rawKey.replace(/^\\/, "").trim();
  const masterWalletId = process.env.ASAAS_MASTER_WALLET_ID;

  if (!masterApiKey) {
    logWarn(
      "[Asaas] Atenção: ASAAS_API_KEY não configurada no ambiente.",
    );
  }

  return {
    apiUrl: apiUrl.replace(/\/$/, ""),
    masterApiKey,
    masterWalletId,
  };
}

export class AsaasApiError extends Error {
  code?: string;
  status: number;
  errors?: Array<{ code: string; description: string }>;

  constructor(
    message: string,
    status: number,
    errors?: Array<{ code: string; description: string }>,
  ) {
    super(message);
    this.name = "AsaasApiError";
    this.status = status;
    this.errors = errors;
    this.code = errors?.[0]?.code;
  }
}

/**
 * Função base para requisições à API do Asaas.
 */
async function asaasFetch<T>(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    apiKey?: string;
  } = {},
): Promise<T> {
  const config = getAsaasConfig();
  const token = options.apiKey || config.masterApiKey;

  if (!token) {
    throw new AsaasApiError(
      "Chave de API do Asaas não configurada.",
      401,
    );
  }

  const url = `${config.apiUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    access_token: token,
  };

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorList = data?.errors as
      | Array<{ code: string; description: string }>
      | undefined;
    const errorMsg =
      errorList?.map((e) => e.description).join(" | ") ||
      data?.message ||
      `Erro na chamada ao Asaas (HTTP ${response.status})`;

    logError(`[Asaas] Erro em ${options.method || "GET"} ${endpoint}:`, {
      status: response.status,
      errors: errorList,
    });

    throw new AsaasApiError(errorMsg, response.status, errorList);
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// Métodos da API
// ---------------------------------------------------------------------------

/**
 * Consulta os dados da conta (Master ou Subconta) vinculada à chave de API.
 */
export async function getAccountInfo(apiKey?: string): Promise<Record<string, unknown>> {
  return asaasFetch<Record<string, unknown>>("/myAccount", { apiKey });
}

/**
 * Tarifas da conta dona da chave (GET /myAccount/fees). Com a chave da
 * subconta, devolve as tarifas do espaco; a da conta principal nunca e usada aqui.
 */
export async function getAccountFees(apiKey: string): Promise<unknown> {
  return asaasFetch<unknown>("/myAccount/fees/", { apiKey });
}

/** Webhooks cadastrados na conta dona da chave. */
export async function listWebhooks(apiKey: string): Promise<AsaasWebhookResponse[]> {
  const res = await asaasFetch<{ data?: AsaasWebhookResponse[] }>("/webhooks", { apiKey });
  return res.data ?? [];
}

export async function createWebhook(config: AsaasWebhookConfig, apiKey: string): Promise<AsaasWebhookResponse> {
  return asaasFetch<AsaasWebhookResponse>("/webhooks", { method: "POST", body: config, apiKey });
}

export async function updateWebhook(
  id: string,
  config: AsaasWebhookConfig,
  apiKey: string,
): Promise<AsaasWebhookResponse> {
  return asaasFetch<AsaasWebhookResponse>(`/webhooks/${id}`, { method: "PUT", body: config, apiKey });
}

/**
 * Cria uma subconta filha vinculada à conta Master do GestaraHub.
 */
export async function createSubAccount(
  accountData: AsaasAccountRequest,
): Promise<AsaasAccountResponse> {
  return asaasFetch<AsaasAccountResponse>("/accounts", {
    method: "POST",
    body: accountData,
  });
}

/**
 * Cria ou busca um cliente (Aluno) no Asaas. Primeiro pelo id do aluno
 * (`externalReference`): o mesmo aluno e sempre o mesmo cliente, e os dados
 * de contato e endereco sao atualizados com o cadastro atual. Depois pelo CPF.
 */
export async function createOrFindCustomer(
  customerData: AsaasCustomerRequest,
  subaccountApiKey?: string,
): Promise<AsaasCustomerResponse> {
  if (customerData.externalReference) {
    try {
      const byRef = await asaasFetch<{ data: AsaasCustomerResponse[] }>(
        `/customers?externalReference=${encodeURIComponent(customerData.externalReference)}`,
        { apiKey: subaccountApiKey },
      );
      const existing = byRef.data?.[0];
      if (existing) {
        // Atualiza com o cadastro atual (inclusive o CPF: o pagador pode mudar,
        // ex.: aluno que fez 18 anos deixa de pagar pelo responsavel).
        const changes = Object.fromEntries(Object.entries(customerData).filter(([, v]) => v !== undefined));
        try {
          return await asaasFetch<AsaasCustomerResponse>(`/customers/${existing.id}`, {
            method: "PUT",
            body: changes,
            apiKey: subaccountApiKey,
          });
        } catch {
          return existing;
        }
      }
    } catch {
      // continua pela busca por CPF
    }
  }

  // Se informou CPF/CNPJ, tenta buscar primeiro para não duplicar
  if (customerData.cpfCnpj) {
    const cleanCpf = customerData.cpfCnpj.replace(/\D/g, "");
    try {
      const searchRes = await asaasFetch<{
        data: AsaasCustomerResponse[];
      }>(`/customers?cpfCnpj=${cleanCpf}`, { apiKey: subaccountApiKey });

      if (searchRes.data && searchRes.data.length > 0) {
        return searchRes.data[0];
      }
    } catch {
      // continua para a criação
    }
  }

  return asaasFetch<AsaasCustomerResponse>("/customers", {
    method: "POST",
    body: customerData,
    apiKey: subaccountApiKey,
  });
}

/**
 * Cria uma cobrança Pix com split automático na subconta.
 */
export async function createPixPayment(
  paymentData: AsaasPaymentRequest,
  subaccountApiKey?: string,
): Promise<AsaasPaymentResponse> {
  return asaasFetch<AsaasPaymentResponse>("/payments", {
    method: "POST",
    body: paymentData,
    apiKey: subaccountApiKey,
  });
}

/**
 * Obtém a imagem do QR Code (Base64) e o código Pix Copia-e-Cola de uma cobrança.
 */
export async function getPixQrCode(
  paymentId: string,
  subaccountApiKey?: string,
): Promise<AsaasPixQrCodeResponse> {
  return asaasFetch<AsaasPixQrCodeResponse>(
    `/payments/${paymentId}/pixQrCode`,
    { apiKey: subaccountApiKey },
  );
}

/**
 * Consulta os detalhes de um pagamento pelo ID no Asaas.
 */
export async function getPayment(
  paymentId: string,
  subaccountApiKey?: string,
): Promise<AsaasPaymentResponse> {
  return asaasFetch<AsaasPaymentResponse>(`/payments/${paymentId}`, {
    apiKey: subaccountApiKey,
  });
}

/**
 * Cancela/remove uma cobrança no Asaas.
 */
export async function deletePayment(
  paymentId: string,
  subaccountApiKey?: string,
): Promise<{ deleted: boolean; id: string }> {
  return asaasFetch<{ deleted: boolean; id: string }>(
    `/payments/${paymentId}`,
    {
      method: "DELETE",
      apiKey: subaccountApiKey,
    },
  );
}

/**
 * Consulta o saldo financeiro da subconta.
 */
export async function getSubaccountBalance(
  subaccountApiKey: string,
): Promise<AsaasBalanceResponse> {
  return asaasFetch<AsaasBalanceResponse>("/finance/balance", {
    apiKey: subaccountApiKey,
  });
}

/**
 * Confirma recebimento manual/em dinheiro de uma cobrança no Asaas (útil para testes em homologação/Sandbox).
 */
export async function receiveInCash(
  paymentId: string,
  paymentDate: string,
  value: number,
  subaccountApiKey?: string,
): Promise<AsaasPaymentResponse> {
  return asaasFetch<AsaasPaymentResponse>(`/payments/${paymentId}/receiveInCash`, {
    method: "POST",
    body: {
      paymentDate,
      value,
      notifyCustomer: false,
    },
    apiKey: subaccountApiKey,
  });
}

/**
 * Realiza uma transferência / saque via Pix da subconta para a conta bancária do titular.
 */
export async function createTransfer(
  data: AsaasTransferRequest,
  subaccountApiKey: string,
): Promise<AsaasTransferResponse> {
  return asaasFetch<AsaasTransferResponse>("/transfers", {
    method: "POST",
    body: data,
    apiKey: subaccountApiKey,
  });
}

/**
 * Lista as transferências / saques realizados na subconta.
 */
export async function listTransfers(
  subaccountApiKey: string,
): Promise<{ data: AsaasTransferResponse[] }> {
  return asaasFetch<{ data: AsaasTransferResponse[] }>("/transfers", {
    apiKey: subaccountApiKey,
  });
}

/**
 * Cria uma assinatura no Asaas (usada para a assinatura da plataforma GestaraHub).
 */
export async function createSubscription(
  subscriptionData: AsaasSubscriptionRequest,
  apiKey?: string,
): Promise<AsaasSubscriptionResponse> {
  return asaasFetch<AsaasSubscriptionResponse>("/subscriptions", {
    method: "POST",
    body: subscriptionData,
    apiKey,
  });
}

/**
 * Consulta uma assinatura pelo ID no Asaas.
 */
export async function getSubscription(
  subscriptionId: string,
  apiKey?: string,
): Promise<AsaasSubscriptionResponse> {
  return asaasFetch<AsaasSubscriptionResponse>(`/subscriptions/${subscriptionId}`, {
    apiKey,
  });
}

/**
 * Lista as cobranças vinculadas a uma assinatura no Asaas.
 */
export async function getSubscriptionPayments(
  subscriptionId: string,
  apiKey?: string,
): Promise<{ data: AsaasPaymentResponse[] }> {
  return asaasFetch<{ data: AsaasPaymentResponse[] }>(
    `/subscriptions/${subscriptionId}/payments`,
    { apiKey },
  );
}

/**
 * Cancela uma assinatura no Asaas.
 */
export async function cancelSubscription(
  subscriptionId: string,
  apiKey?: string,
): Promise<{ deleted: boolean; id: string }> {
  return asaasFetch<{ deleted: boolean; id: string }>(
    `/subscriptions/${subscriptionId}`,
    {
      method: "DELETE",
      apiKey,
    },
  );
}


