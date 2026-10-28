import type {
  MetaTemplateInfo,
  MetaTemplateStatus,
  SendWhatsAppTemplateMessagePayload,
  SendWhatsAppTextMessagePayload,
  WhatsAppConfig,
  WhatsAppErrorResponse,
  WhatsAppMessageResponse,
} from "./types";
import { logError } from "@/lib/log";
import { whatsappDigits } from "@gestarahub/core/phone";

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
  if (!phone) return "";
  const parsed = whatsappDigits(phone);
  if (parsed) return parsed;

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
  if (!cleanTo) {
    throw new Error("[WhatsApp] Número de destinatário inválido.");
  }

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
    logError("[WhatsApp Cloud API Error]:", err);
    throw new WhatsAppApiError(msg, err.error?.code || res.status, err.error?.type || "ApiError", err.error?.fbtrace_id);
  }

  return data as WhatsAppMessageResponse;
}

/**
 * Envia uma mensagem baseada em Modelo (Template) aprovado pela Meta.
 * (Ex: lembrete de cobrança, aniversários, boas-vindas).
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
  if (!cleanTo) {
    throw new Error("[WhatsApp] Número de destinatário inválido.");
  }

  const url = `${config.apiUrl}/${config.phoneNumberId}/messages`;

  const components = payload.components ?? (payload.bodyParameters?.length
    ? [
        {
          type: "body" as const,
          parameters: payload.bodyParameters.map((param) => ({
            type: "text" as const,
            text: param,
          })),
        },
      ]
    : undefined);

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
    logError("[WhatsApp Cloud API Error]:", err);
    throw new WhatsAppApiError(msg, err.error?.code || res.status, err.error?.type || "ApiError", err.error?.fbtrace_id);
  }

  return data as WhatsAppMessageResponse;
}

/**
 * Converte o texto com variáveis no formato do GestaraHub ({aluno}, {valor}...)
 * para o formato posicional da Meta ({{1}}, {{2}}...), garantindo que o texto
 * não termine em variável (regra de rejeição da Meta).
 */
export function convertGestaraVariablesToMetaPositional(content: string): {
  metaText: string;
  variables: string[];
} {
  const variables: string[] = [];
  let index = 1;
  const converted = content.replace(/\{(\w+)\}/g, (match) => {
    variables.push(match);
    return `{{${index++}}}`;
  });

  let safeText = converted.trim();
  if (safeText.endsWith("}}")) {
    safeText += ".";
  }

  return { metaText: safeText, variables };
}

/**
 * Consulta a lista oficial de templates cadastrados na Meta WhatsApp Business Account (WABA)
 * e devolve os status em tempo real (APPROVED, PENDING, REJECTED, PAUSED).
 */
export async function listWhatsAppTemplates(
  overrideConfig?: Partial<WhatsAppConfig>,
): Promise<MetaTemplateInfo[]> {
  const config = { ...getWhatsAppConfig(), ...overrideConfig };
  if (!config.apiToken || !config.businessAccountId) {
    return [];
  }

  const url = `${config.apiUrl}/${config.businessAccountId}/message_templates`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
      },
    });

    if (!res.ok) {
      logError("[WhatsApp] Falha ao listar templates da Meta:", res.status);
      return [];
    }

    const data = await res.json();
    const list = (data.data || []) as Array<{
      name: string;
      status: MetaTemplateStatus;
      category: string;
      id: string;
      rejected_reason?: string;
    }>;

    return list.map((item) => ({
      name: item.name,
      status: item.status,
      category: item.category,
      id: item.id,
      rejectionReason: item.rejected_reason,
    }));
  } catch (err) {
    logError("[WhatsApp] Erro de rede ao buscar templates da Meta:", err);
    return [];
  }
}

/**
 * Cria ou atualiza um template oficial na Meta WhatsApp Business Account via Graph API.
 */
export async function createOrUpdateWhatsAppTemplate(
  payload: {
    name: string;
    category: "UTILITY" | "MARKETING";
    content: string;
    languageCode?: string;
  },
  overrideConfig?: Partial<WhatsAppConfig>,
): Promise<{ id: string; status: MetaTemplateStatus }> {
  const config = { ...getWhatsAppConfig(), ...overrideConfig };
  if (!config.apiToken || !config.businessAccountId) {
    throw new Error("[WhatsApp] Credenciais WHATSAPP_API_TOKEN e WHATSAPP_BUSINESS_ACCOUNT_ID são obrigatórias.");
  }

  const { metaText, variables } = convertGestaraVariablesToMetaPositional(payload.content);

  const exampleValues = variables.map((v) => {
    if (v === "{aluno}") return "João";
    if (v === "{valor}") return "R$ 150,00";
    if (v === "{vencimento}") return "10/11/2026";
    if (v === "{empresa}") return "Academia Gestara";
    if (v === "{link_pagamento}") return "https://gestarahub.com/p/exemplo";
    return "exemplo";
  });

  const body = {
    name: payload.name,
    category: payload.category,
    language: payload.languageCode || "pt_BR",
    components: [
      {
        type: "BODY",
        text: metaText,
        ...(exampleValues.length > 0 ? { example: { body_text: [exampleValues] } } : {}),
      },
    ],
  };

  const url = `${config.apiUrl}/${config.businessAccountId}/message_templates`;

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
    const msg = err.error?.message || "Erro desconhecido ao cadastrar template na Meta.";
    logError("[WhatsApp Template Submit Error]:", err);
    throw new WhatsAppApiError(msg, err.error?.code || res.status, err.error?.type || "ApiError", err.error?.fbtrace_id);
  }

  return {
    id: data.id,
    status: data.status || "PENDING",
  };
}
