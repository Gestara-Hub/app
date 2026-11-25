import type {
  AsaasAccountRequest,
  AsaasWebhookConfig,
  AsaasWebhookResponse,
  AsaasAccountResponse,
  AsaasCreateInvoiceRequest,
  AsaasCustomerRequest,
  AsaasInvoiceResponse,
  AsaasCustomerResponse,
  AsaasPaymentRequest,
  AsaasPaymentResponse,
  AsaasPixAutomaticAuthorization,
  AsaasPixQrCodeResponse,
  AsaasBalanceResponse,
  AsaasTransferRequest,
  AsaasTransferResponse,
  AsaasSubscriptionRequest,
  AsaasSubscriptionResponse,
  AsaasSubscriptionUpdate,
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

/** Tempo maximo de cada chamada ao Asaas. */
const ASAAS_TIMEOUT_MS = 20_000;
/** Esperas entre as tentativas de uma consulta (GET). */
export const ASAAS_GET_RETRY_DELAYS_MS: number[] = [500, 1500];

/**
 * Função base para requisições à API do Asaas.
 */
async function asaasFetch<T>(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    apiKey?: string;
    /** Chamada que o Asaas demora para concluir (abrir subconta): espera mais. */
    timeoutMs?: number;
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

  const method = options.method || "GET";
  const send = () =>
    fetch(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? ASAAS_TIMEOUT_MS),
    });

  // Consulta (GET) tenta de novo em falha de rede, limite (429) ou Asaas fora
  // (5xx). Criacao, alteracao e exclusao nao: repetir pode cobrar ou sacar em
  // dobro; a pessoa ve o erro e decide.
  const retries = method === "GET" ? ASAAS_GET_RETRY_DELAYS_MS : [];
  let response: Response | undefined;
  for (let attempt = 0; ; attempt++) {
    try {
      response = await send();
      if (!(response.status === 429 || response.status >= 500) || attempt >= retries.length) break;
    } catch (err) {
      if (attempt >= retries.length) throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, retries[attempt]));
  }

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

/** Dados comerciais da conta dona da chave (GET /myAccount/commercialInfo): o topo da fatura. */
export async function getCommercialInfo(apiKey: string): Promise<Record<string, unknown>> {
  return asaasFetch<Record<string, unknown>>("/myAccount/commercialInfo/", { apiKey });
}

/** Atualiza os dados comerciais da conta dona da chave (POST /myAccount/commercialInfo). */
export async function updateCommercialInfo(apiKey: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return asaasFetch<Record<string, unknown>>("/myAccount/commercialInfo/", { method: "POST", body, apiKey });
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
    // Abrir a subconta passou de 20 s em producao (25/11/2026): o Asaas criou a
    // conta, mas a resposta com a chave chegou depois do corte e se perdeu.
    timeoutMs: SUBACCOUNT_TIMEOUT_MS,
  });
}

/** Espera da abertura da subconta: ate 2 minutos (a rota de Recebimentos online aguenta 150 s). */
export const SUBACCOUNT_TIMEOUT_MS = 120_000;

/** Situacao cadastral da conta dona da chave (subconta): a aprovacao geral e as partes. */
export async function getAccountStatus(apiKey: string): Promise<{
  general?: string;
  documentation?: string;
  commercialInfo?: string;
  bankAccountInfo?: string;
}> {
  return asaasFetch("/myAccount/status/", { apiKey });
}

/** Documentos que o Asaas pede para aprovar a conta dona da chave (grupos, com o link de envio quando houver). */
export async function getAccountDocuments(apiKey: string): Promise<{
  rejectReasons?: string | null;
  data?: {
    id: string;
    status?: string;
    type?: string;
    title?: string;
    description?: string;
    onboardingUrl?: string | null;
  }[];
}> {
  return asaasFetch("/myAccount/documents", { apiKey });
}

/** Subcontas da conta principal com este e-mail (a chave nao vem: so id e carteira). */
export async function findSubAccountsByEmail(email: string): Promise<Pick<AsaasAccountResponse, "id" | "walletId" | "email" | "cpfCnpj">[]> {
  const res = await asaasFetch<{ data?: Pick<AsaasAccountResponse, "id" | "walletId" | "email" | "cpfCnpj">[] }>(
    `/accounts?email=${encodeURIComponent(email.trim())}`,
  );
  return res.data ?? [];
}

/** Campos que so comparam os digitos (o Asaas devolve sem mascara). */
const DIGIT_FIELDS = new Set(["cpfCnpj", "postalCode", "mobilePhone", "phone"]);

/** O cadastro do cliente no Asaas difere do que vai ser gravado? */
export function customerChanged(existing: object, changes: Record<string, unknown>): boolean {
  const current = existing as Record<string, unknown>;
  return Object.entries(changes).some(([key, value]) => {
    const before = current[key];
    if (typeof value === "boolean") return Boolean(before) !== value;
    const norm = (v: unknown) => {
      const text = v === undefined || v === null ? "" : String(v).trim();
      return DIGIT_FIELDS.has(key) ? text.replace(/\D/g, "") : text;
    };
    return norm(before) !== norm(value);
  });
}

/**
 * Cria ou busca um cliente (Aluno) no Asaas. Primeiro pelo id do aluno
 * (`externalReference`): o mesmo aluno e sempre o mesmo cliente, e os dados
 * de contato e endereco sao atualizados com o cadastro atual. Pelo CPF so
 * quando nao ha o id do aluno.
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
        // Nada mudou: sem a chamada de atualizacao (19/11/2026: uma chamada a
        // menos em cada Pix gerado).
        if (!customerChanged(existing, changes)) return existing;
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

  // Busca pelo CPF so sem o id do aluno. Com ele, o cliente achado pelo CPF e
  // de outro aluno (irmao com o mesmo responsavel, ou um CPF digitado na pagina
  // publica) e voltaria com o nome de outra pessoa na fatura: cria um novo (o
  // Asaas aceita mais de um cliente com o mesmo CPF).
  if (customerData.cpfCnpj && !customerData.externalReference) {
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

/** Chaves Pix da conta (so o que interessa para saber se existe alguma). */
export interface AsaasPixAddressKey {
  id: string;
  key?: string;
  type: string;
  status: string;
}

/** Lista as chaves Pix da subconta. */
export async function listPixAddressKeys(subaccountApiKey?: string): Promise<AsaasPixAddressKey[]> {
  const res = await asaasFetch<{ data?: AsaasPixAddressKey[] }>("/pix/addressKeys", { apiKey: subaccountApiKey });
  return res.data ?? [];
}

/**
 * Cria uma chave Pix aleatoria (EVP) na subconta. Sem chave, o Asaas gera uma
 * temporaria a cada cobranca e o primeiro QR costuma falhar ("Você não possui
 * uma chave Pix cadastrada"). Uma por minuto, no maximo 5 (PF) ou 20 (PJ).
 */
export async function createPixAddressKey(subaccountApiKey?: string): Promise<AsaasPixAddressKey> {
  return asaasFetch<AsaasPixAddressKey>("/pix/addressKeys", {
    method: "POST",
    body: { type: "EVP" },
    apiKey: subaccountApiKey,
  });
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

/** Autorizacoes de Pix Automatico de uma assinatura (oferta na assinatura com Pix). */
export async function listSubscriptionPixAutomaticAuthorizations(
  subscriptionId: string,
): Promise<AsaasPixAutomaticAuthorization[]> {
  const res = await asaasFetch<{ data?: AsaasPixAutomaticAuthorization[] }>(
    `/pix/automatic/authorizations?subscriptionId=${encodeURIComponent(subscriptionId)}`,
  );
  return res.data ?? [];
}

/**
 * Atualiza a assinatura (valor, ciclo, proximo vencimento). Troca de plano:
 * uma assinatura so por espaco (doc product/13 §6).
 */
export async function updateSubscription(
  subscriptionId: string,
  update: AsaasSubscriptionUpdate,
  apiKey?: string,
): Promise<AsaasSubscriptionResponse> {
  return asaasFetch<AsaasSubscriptionResponse>(`/subscriptions/${subscriptionId}`, {
    method: "PUT",
    body: update,
    apiKey,
  });
}

/**
 * Atualiza uma cobranca ainda nao paga (ex.: o valor da proxima renovacao).
 */
export async function updatePayment(
  paymentId: string,
  update: { value?: number; dueDate?: string; description?: string },
  apiKey?: string,
): Promise<AsaasPaymentResponse> {
  return asaasFetch<AsaasPaymentResponse>(`/payments/${paymentId}`, {
    method: "PUT",
    body: update,
    apiKey,
  });
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



/** Nota fiscal (NFS-e) de uma cobranca, pela conta principal (doc technical/24 §7.1). */
export async function createInvoice(invoice: AsaasCreateInvoiceRequest): Promise<AsaasInvoiceResponse> {
  return asaasFetch<AsaasInvoiceResponse>("/invoices", { method: "POST", body: invoice });
}

export async function getInvoice(invoiceId: string): Promise<AsaasInvoiceResponse> {
  return asaasFetch<AsaasInvoiceResponse>(`/invoices/${encodeURIComponent(invoiceId)}`);
}

/** Notas de uma cobranca (a nota pode ja existir: pedido anterior que voltou sem resposta). */
export async function listPaymentInvoices(paymentId: string): Promise<AsaasInvoiceResponse[]> {
  const res = await asaasFetch<{ data?: AsaasInvoiceResponse[] }>(`/invoices?payment=${encodeURIComponent(paymentId)}`);
  return res.data ?? [];
}

export async function cancelInvoice(invoiceId: string): Promise<AsaasInvoiceResponse> {
  return asaasFetch<AsaasInvoiceResponse>(`/invoices/${encodeURIComponent(invoiceId)}/cancel`, { method: "POST" });
}
