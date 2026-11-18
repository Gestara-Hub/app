import { randomInt } from "node:crypto";
import { apiError } from "@gestarahub/core/api-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { WhatsAppMetaHealth } from "@gestarahub/contracts";
import { getWhatsAppConfig, getWhatsAppPhoneNumberDetails, WhatsAppApiError, type WhatsAppConfig } from "@/lib/whatsapp";
import { META_HEALTH_FIELDS, parseMetaHealth, type RawMetaHealth } from "@/lib/whatsapp/meta-health";
import { logError, logWarn } from "@/lib/log";
import {
  setWhatsAppCredentialsGateway,
  type ConnectWhatsAppInput,
  type ConnectedWhatsAppNumber,
  type WhatsAppCredentialsGateway,
} from "./whatsappCredentialsGateway";

/**
 * Credenciais do WhatsApp oficial de cada espaco (doc technical/07 §1.1). So
 * do servidor: troca o codigo do cadastro guiado da Meta pelo token do espaco,
 * guarda token e PIN no Vault (`whatsapp_credentials`, migracao 103), registra
 * o numero novo na API e inscreve o app nos avisos da conta do espaco.
 */

/** Ids da Meta sao numeros; nada alem disso entra no caminho da Graph API. */
const META_ID = /^\d{5,30}$/;

/** Credenciais lidas do Vault ficam um minuto na memoria do processo. */
const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; config: Partial<WhatsAppConfig> | null }>();

interface GraphErrorBody {
  error?: { message?: string; code?: number; type?: string; fbtrace_id?: string; error_user_msg?: string };
}

async function graph<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  const res = await fetch(`${getWhatsAppConfig().apiUrl}/${path}`, {
    ...rest,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & GraphErrorBody;
  if (!res.ok) {
    const err = data.error;
    throw new WhatsAppApiError(
      err?.error_user_msg || err?.message || `Erro ${res.status} na Meta.`,
      err?.code ?? res.status,
      err?.type ?? "ApiError",
      err?.fbtrace_id,
    );
  }
  return data;
}

function metaAppCredentials(): { appId: string; appSecret: string } {
  const appId = process.env.META_APP_ID?.trim() || process.env.NEXT_PUBLIC_META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw apiError(
      "SERVICE_UNAVAILABLE",
      "A conexão com o WhatsApp oficial ainda não está configurada. Fale com o suporte.",
      { httpStatus: 503 },
    );
  }
  return { appId, appSecret };
}

/** Codigo de uso unico do cadastro guiado -> token do espaco (usuario de sistema da integracao). */
export async function exchangeSignupCode(code: string): Promise<string> {
  const { appId, appSecret } = metaAppCredentials();
  const params = new URLSearchParams({ client_id: appId, client_secret: appSecret, code });
  const data = await graph<{ access_token?: string }>(`oauth/access_token?${params.toString()}`);
  if (!data.access_token) throw new WhatsAppApiError("A Meta não devolveu o acesso do número.", 0, "OAuthException");
  return data.access_token;
}

function metaFailure(step: string, err: unknown): never {
  logError(`[whatsappCredentials] ${step}:`, err);
  const detail = err instanceof WhatsAppApiError ? ` (${err.message})` : "";
  throw apiError("SERVICE_UNAVAILABLE", `Não foi possível ${step} na Meta${detail}. Tente conectar de novo.`, {
    httpStatus: 502,
  });
}

async function dropCredentials(organizationId: string): Promise<void> {
  cache.delete(organizationId);
  const { error } = await createSupabaseAdminClient()
    .from("whatsapp_credentials")
    .delete()
    .eq("organization_id", organizationId);
  if (error) logError("[whatsappCredentials] Credenciais não apagadas:", error);
}

/** PIN de dois fatores diferente do que esta no numero (Cloud API). */
const PIN_MISMATCH = 133005;

/**
 * O numero ja esta ativo na API oficial (`platform_type` CLOUD_API e `status`
 * CONNECTED)? Sem resposta da Meta, considera que nao (o registro segue).
 */
async function alreadyOnCloudApi(phoneNumberId: string, token: string): Promise<boolean> {
  try {
    const data = await graph<{ status?: string; platform_type?: string }>(`${phoneNumberId}?fields=status,platform_type`, {
      token,
    });
    return data.platform_type === "CLOUD_API" && data.status === "CONNECTED";
  } catch (err) {
    logWarn("[whatsappCredentials] Situação do número não consultada antes do registro:", err);
    return false;
  }
}

async function connect(input: ConnectWhatsAppInput): Promise<ConnectedWhatsAppNumber> {
  const { organizationId, code, phoneNumberId, wabaId, businessId, onboarding } = input;
  if (!META_ID.test(phoneNumberId) || !META_ID.test(wabaId) || (businessId && !META_ID.test(businessId))) {
    throw apiError("VALIDATION", "A Meta devolveu dados inválidos. Tente conectar de novo.", { httpStatus: 422 });
  }

  let token: string;
  try {
    token = await exchangeSignupCode(code);
  } catch (err) {
    if (err instanceof WhatsAppApiError) metaFailure("confirmar o acesso ao número", err);
    throw err;
  }

  // O token so serve se enxerga o numero escolhido no cadastro.
  const details = await getWhatsAppPhoneNumberDetails(phoneNumberId, { apiToken: token });
  if (!details?.displayPhoneNumber) {
    throw apiError(
      "SERVICE_UNAVAILABLE",
      "Não foi possível confirmar o número na Meta. Tente conectar de novo.",
      { httpStatus: 502 },
    );
  }

  // Numero novo na API: registro com PIN de dois fatores (guardado no Vault).
  // Coexistencia: o numero ja esta no app WhatsApp Business, sem registro.
  // Numero que ja esta ativo na API (reconectar depois de desconectar): sem
  // registro de novo, que pediria o PIN antigo, apagado ao desconectar (18/11/2026).
  const needsRegister = onboarding === "cloud" && !(await alreadyOnCloudApi(phoneNumberId, token));
  const pin = needsRegister ? String(randomInt(0, 1_000_000)).padStart(6, "0") : null;

  const admin = createSupabaseAdminClient();
  const { error: saveError } = await admin.rpc("whatsapp_credentials_save", {
    p_organization_id: organizationId,
    p_phone_number_id: phoneNumberId,
    p_waba_id: wabaId,
    p_business_id: businessId ?? null,
    p_onboarding: onboarding,
    p_token: token,
    p_pin: pin,
  });
  if (saveError) {
    if (saveError.code === "PT409") {
      throw apiError("SERVICE_UNAVAILABLE", "Este número já está conectado a outro espaço no GestaraHub.", { httpStatus: 409 });
    }
    logError("[whatsappCredentials] Credenciais não gravadas:", saveError);
    throw apiError("SERVICE_UNAVAILABLE", "Não foi possível salvar a conexão. Tente de novo.", { httpStatus: 502 });
  }
  cache.delete(organizationId);

  const stamps: Record<string, string> = {};
  try {
    if (pin) {
      await graph(`${phoneNumberId}/register`, {
        method: "POST",
        token,
        body: JSON.stringify({ messaging_product: "whatsapp", pin }),
      });
      stamps.registered_at = new Date().toISOString();
    }
  } catch (err) {
    // PIN diferente do que esta no numero (133005): ele ja esta registrado na
    // API; segue sem o registro novo.
    if (err instanceof WhatsAppApiError && err.code === PIN_MISMATCH) {
      logWarn("[whatsappCredentials] Número já registrado com outro PIN; segue sem registrar de novo.");
    } else {
      await dropCredentials(organizationId);
      metaFailure("ativar o número na API do WhatsApp", err);
    }
  }
  try {
    await graph(`${wabaId}/subscribed_apps`, { method: "POST", token });
    stamps.subscribed_at = new Date().toISOString();
  } catch (err) {
    await dropCredentials(organizationId);
    metaFailure("ligar os avisos de entrega", err);
  }

  const { error: stampError } = await admin
    .from("whatsapp_credentials")
    .update(stamps)
    .eq("organization_id", organizationId);
  if (stampError) logWarn("[whatsappCredentials] Datas do registro não gravadas:", stampError);

  return { displayPhoneNumber: details.displayPhoneNumber, verifiedName: details.verifiedName || undefined };
}

interface StoredCredentials {
  phone_number_id: string;
  waba_id: string;
  token: string | null;
}

async function readCredentials(organizationId: string): Promise<StoredCredentials | null> {
  const { data, error } = await createSupabaseAdminClient().rpc("whatsapp_credentials_get", {
    p_organization_id: organizationId,
  });
  if (error) {
    logError("[whatsappCredentials] Credenciais não lidas:", error);
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as StoredCredentials | undefined;
  return row?.token ? row : null;
}

async function configFor(organizationId: string): Promise<Partial<WhatsAppConfig> | null> {
  const hit = cache.get(organizationId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.config;
  const row = await readCredentials(organizationId);
  const config = row
    ? { apiToken: row.token!, phoneNumberId: row.phone_number_id, businessAccountId: row.waba_id }
    : null;
  cache.set(organizationId, { at: Date.now(), config });
  return config;
}

async function disconnect(organizationId: string): Promise<void> {
  const row = await readCredentials(organizationId);
  if (row?.token) {
    try {
      await graph(`${row.waba_id}/subscribed_apps`, { method: "DELETE", token: row.token });
    } catch (err) {
      // Sem o token, o app nao age mais na conta; os avisos que chegarem sao ignorados.
      logWarn("[whatsappCredentials] Avisos não cancelados na Meta:", err);
    }
  }
  await dropCredentials(organizationId);
}

/**
 * Modelos do espaco para a Meta logo depois de conectar, fora da requisicao
 * que conectou: numa gravacao propria do espaco, como o cron. Imports
 * dinamicos porque o `runWorld` importa este arquivo.
 */
async function syncTemplates(organizationId: string): Promise<void> {
  try {
    const [{ cronContext }, { runInWorld }, { templatesService }] = await Promise.all([
      import("./billingRemindersCron"),
      import("../world/runWorld"),
      import("./templatesService"),
    ]);
    const ctx = await cronContext(organizationId);
    if (!ctx) return;
    const result = await runInWorld(ctx, () => templatesService.syncMetaTemplates(), { name: "whatsapp.syncTemplates" });
    if (result.failed > 0) logWarn(`[whatsappCredentials] ${result.failed} modelo(s) não enviados à Meta ao conectar.`);
  } catch (err) {
    logError("[whatsappCredentials] Modelos não enviados à Meta ao conectar:", err);
  }
}

/**
 * Situacao do numero e da conta na Meta (doc technical/07 §1.6), com o token do
 * proprio espaco. Sem credencial ou com a Meta fora do ar: null (a tela mantem
 * a ultima situacao gravada).
 */
async function fetchHealth(organizationId: string): Promise<WhatsAppMetaHealth | null> {
  const row = await readCredentials(organizationId);
  if (!row?.token) return null;
  try {
    const raw = await graph<RawMetaHealth>(`${row.phone_number_id}?fields=${META_HEALTH_FIELDS}`, { token: row.token });
    return parseMetaHealth(raw, new Date().toISOString());
  } catch (err) {
    logWarn("[whatsappCredentials] Situação na Meta não consultada:", err);
    return null;
  }
}

/** Consulta e grava direto na conexao (rotina e depois de conectar, fora de um espaco carregado). */
async function refreshHealth(organizationId: string): Promise<WhatsAppMetaHealth | null> {
  const health = await fetchHealth(organizationId);
  if (!health) return null;
  const { error } = await createSupabaseAdminClient()
    .from("whatsapp_connections")
    .update({ meta_health: health })
    .eq("organization_id", organizationId)
    .eq("official_status", "connected");
  if (error) logWarn("[whatsappCredentials] Situação na Meta não gravada:", error);
  return health;
}

export const whatsappCredentialsGateway: WhatsAppCredentialsGateway = {
  connect,
  disconnect,
  configFor,
  syncTemplates,
  fetchHealth,
  refreshHealth,
};

setWhatsAppCredentialsGateway(whatsappCredentialsGateway);
