import type {
  SendWhatsAppTemplateMessagePayload,
  SendWhatsAppTextMessagePayload,
  WhatsAppConfig,
  WhatsAppErrorResponse,
  WhatsAppMessageResponse,
} from "./types";

export function getWhatsAppConfig(): WhatsAppConfig {
  const apiUrl = process.env.WHATSAPP_API_URL || "https://graph.facebook.com/v21.0";
  const apiToken = process.env.WHATSAPP_API_TOKEN || "";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

  return {
    apiUrl: apiUrl.replace(/\/$/, ""),
    apiToken,
    phoneNumberId,
    businessAccountId,
  };
}

/**
 * Normaliza o telefone para o formato exigido pela Meta:
 * Somente dígitos com DDI e DDD (ex: 5592991844219).
 */
export function normalizeWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    return digits;
  }
  // Se veio sem DDI brasileiro, adiciona 55
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

export class WhatsAppApiError extends Error {
  code: number;
  type: string;
  fbtraceId?: string;

  constructor(message: string, code: number, type: string, fbtraceId?: string) {
    super(message);
    this.name = "WhatsAppApiError";
    this.code = code;
    this.type = type;
    this.fbtraceId = fbtraceId;
  }
}

/**
 * Envia uma mensagem de texto livre via Meta Cloud API.
 * (Válido para janelas abertas de conversa ou testes autorizados).
 */
export async function sendWhatsAppTextMessage(
  payload: SendWhatsAppTextMessagePayload,
  overrideConfig?: Partial<WhatsAppConfig>,
): Promise<WhatsAppMessageResponse> {
  const config = { ...getWhatsAppConfig(), ...overrideConfig };
  if (!config.apiToken || !config.phoneNumberId) {
    throw new Error("[WhatsApp] Credenciais WHATSAPP_API_TOKEN e WHATSAPP_PHONE_NUMBER_ID são obrigatórias.");
  }

  const cleanTo = normalizeWhatsAppNumber(payload.to);
  const url = `${config.apiUrl}/${config.phoneNumberId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanTo,
    type: "text",
    text: {
      preview_url: false,
      body: payload.text,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    const err = data as WhatsAppErrorResponse;
    const msg = err.error?.message || "Erro desconhecido ao enviar mensagem pelo WhatsApp.";
    console.error("[WhatsApp Cloud API Error]:", err);
    throw new WhatsAppApiError(msg, err.error?.code || res.status, err.error?.type || "ApiError", err.error?.fbtrace_id);
  }

  return data as WhatsAppMessageResponse;
}

/**
 * Envia uma mensagem baseada em Modelo (Template) aprovado pela Meta.
 * (Ex: hello_world, ou templates de cobrança e lembrete).
 */
export async function sendWhatsAppTemplateMessage(
  payload: SendWhatsAppTemplateMessagePayload,
  overrideConfig?: Partial<WhatsAppConfig>,
): Promise<WhatsAppMessageResponse> {
  const config = { ...getWhatsAppConfig(), ...overrideConfig };
  if (!config.apiToken || !config.phoneNumberId) {
    throw new Error("[WhatsApp] Credenciais WHATSAPP_API_TOKEN e WHATSAPP_PHONE_NUMBER_ID são obrigatórias.");
  }

  const cleanTo = normalizeWhatsAppNumber(payload.to);
  const url = `${config.apiUrl}/${config.phoneNumberId}/messages`;

  const components = payload.bodyParameters?.length
    ? [
        {
          type: "body",
          parameters: payload.bodyParameters.map((param) => ({
            type: "text",
            text: param,
          })),
        },
      ]
    : undefined;

  const body = {
    messaging_product: "whatsapp",
    to: cleanTo,
    type: "template",
    template: {
      name: payload.templateName,
      language: {
        code: payload.languageCode || "pt_BR",
      },
      ...(components ? { components } : {}),
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    const err = data as WhatsAppErrorResponse;
    const msg = err.error?.message || "Erro desconhecido ao enviar template de WhatsApp.";
    console.error("[WhatsApp Cloud API Error]:", err);
    throw new WhatsAppApiError(msg, err.error?.code || res.status, err.error?.type || "ApiError", err.error?.fbtrace_id);
  }

  return data as WhatsAppMessageResponse;
}
