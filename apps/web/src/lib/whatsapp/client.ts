import type {
  MetaPhoneNumberDetails,
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

  const url = `${config.apiUrl}/${config.businessAccountId}/message_templates?fields=name,status,category,id,language,rejected_reason&limit=250`;

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
      language?: string;
      rejected_reason?: string;
    }>;

    return list.map((item) => ({
      name: item.name,
      status: item.status,
      category: item.category,
      id: item.id,
      language: item.language,
      rejectionReason: item.rejected_reason && item.rejected_reason !== "NONE" ? item.rejected_reason : undefined,
    }));
  } catch (err) {
    logError("[WhatsApp] Erro de rede ao buscar templates da Meta:", err);
    return [];
  }
}

/** Exemplo de cada variavel para a analise da Meta (ela pede um valor por variavel). */
const TEMPLATE_EXAMPLES: Record<string, string> = {
  "{aluno}": "João",
  "{empresa}": "Academia Gestara",
  "{valor}": "R$ 150,00",
  "{vencimento}": "10/11/2026",
  "{link_pagamento}": "https://gestarahub.com.br/p/exemplo",
  "{link_app}": "https://gestarahub.com.br",
  "{referencia}": "mensalidade de novembro",
  "{restante}": "resta 1 aula",
  "{pacote}": "Pacote 10 aulas",
  "{nivel}": "Faixa azul",
  "{evento}": "Graduação de dezembro",
  "{dia}": "sábado, 12/12",
  "{horario}": "19:00",
};

/** Corpo do modelo no formato da Meta: variaveis posicionais e um exemplo de cada. */
function templateBodyComponents(content: string) {
  const { metaText, variables } = convertGestaraVariablesToMetaPositional(content);
  const exampleValues = variables.map((v) => TEMPLATE_EXAMPLES[v] ?? "exemplo");
  return [
    {
      type: "BODY",
      text: metaText,
      ...(exampleValues.length > 0 ? { example: { body_text: [exampleValues] } } : {}),
    },
  ];
}

/**
 * Edita o texto de um modelo que ja existe na conta (POST /{id-do-modelo}). A
 * Meta analisa de novo; um modelo aprovado aceita 1 edicao por dia e 10 por mes.
 */
export async function editWhatsAppTemplate(
  templateId: string,
  content: string,
  overrideConfig?: Partial<WhatsAppConfig>,
): Promise<{ id: string; status: MetaTemplateStatus }> {
  const config = { ...getWhatsAppConfig(), ...overrideConfig };
  if (!config.apiToken) {
    throw new Error("[WhatsApp] Credenciais da Meta são obrigatórias para editar o modelo.");
  }
  const res = await fetch(`${config.apiUrl}/${templateId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ components: templateBodyComponents(content) }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = data as WhatsAppErrorResponse;
    logError("[WhatsApp Template Edit Error]:", err);
    throw new WhatsAppApiError(
      err.error?.message || "Erro ao editar o modelo na Meta.",
      err.error?.code || res.status,
      err.error?.type || "ApiError",
      err.error?.fbtrace_id,
    );
  }
  return { id: templateId, status: "PENDING" };
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

  const body = {
    name: payload.name,
    category: payload.category,
    language: payload.languageCode || "pt_BR",
    components: templateBodyComponents(payload.content),
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

/**
 * Consulta na Graph API os detalhes do número de telefone registrado na Meta.
 */
export async function getWhatsAppPhoneNumberDetails(
  phoneNumberId: string,
  overrideConfig?: Partial<WhatsAppConfig>,
): Promise<MetaPhoneNumberDetails | null> {
  const config = { ...getWhatsAppConfig(), ...overrideConfig };
  if (!config.apiToken || !phoneNumberId) {
    return null;
  }

  const url = `${config.apiUrl}/${phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
      },
    });

    if (!res.ok) {
      logError("[WhatsApp] Falha ao consultar detalhes do número na Meta:", res.status);
      return null;
    }

    const data = await res.json();
    return {
      id: String(data.id || phoneNumberId),
      verifiedName: String(data.verified_name || ""),
      displayPhoneNumber: String(data.display_phone_number || ""),
      qualityRating: data.quality_rating ? String(data.quality_rating) : undefined,
    };
  } catch (err) {
    logError("[WhatsApp] Erro de rede ao buscar detalhes do telefone na Meta:", err);
    return null;
  }
}
