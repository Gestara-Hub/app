import { MASTER_TEMPLATES } from "./master-templates";
import type { MessageTrigger } from "@gestarahub/contracts";
export interface WhatsAppConfig {
  apiUrl: string;
  apiToken: string;
  phoneNumberId: string;
  businessAccountId?: string;
}

export interface MetaPhoneNumberDetails {
  id: string;
  verifiedName: string;
  displayPhoneNumber: string;
  qualityRating?: string;
}

export interface SendWhatsAppTextMessagePayload {
  to: string; // E.164 sem o '+' (ex: 5511987654321)
  text: string;
}

export interface WhatsAppTemplateParameter {
  type: "text" | "currency" | "date_time" | "image" | "document" | "video";
  text?: string;
  currency?: {
    fallback_value: string;
    code: string;
    amount_1000: number;
  };
  date_time?: {
    fallback_value: string;
  };
}

export interface WhatsAppTemplateComponent {
  type: "header" | "body" | "button";
  sub_type?: "quick_reply" | "url";
  index?: number | string;
  parameters: WhatsAppTemplateParameter[];
}

export interface SendWhatsAppTemplateMessagePayload {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParameters?: string[];
  components?: WhatsAppTemplateComponent[];
}

export interface WhatsAppMessageResponse {
  messaging_product: "whatsapp";
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

export interface WhatsAppErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
    error_data?: {
      messaging_product: string;
      details: string;
    };
    error_subcode?: number;
    /** Motivo legivel que a Meta manda em alguns erros (ex.: modelo recusado). */
    error_user_msg?: string;
    fbtrace_id: string;
  };
}

export type WhatsAppStatusType = "sent" | "delivered" | "read" | "failed";

export type { MetaTemplateStatus } from "@gestarahub/contracts";
import type { MetaTemplateStatus } from "@gestarahub/contracts";

export interface MetaTemplateInfo {
  name: string;
  status: MetaTemplateStatus;
  category: string;
  id: string;
  language?: string;
  rejectionReason?: string;
}

/**
 * Modelo da Meta de cada gatilho: vem dos modelos mestres (doc technical/07
 * §1.7, `master-templates.ts`), com o nome versionado e a categoria. A
 * mensagem avulsa nao tem modelo: e texto livre, so na janela de 24 horas.
 */
export const TRIGGER_TO_META_TEMPLATE: Partial<
  Record<MessageTrigger, { templateName: string; category: "UTILITY" | "MARKETING" }>
> = Object.fromEntries(
  Object.values(MASTER_TEMPLATES).map((t) => [t!.trigger, { templateName: t!.metaName, category: t!.category }]),
);

export interface WhatsAppWebhookStatus {
  id: string; // wamid
  status: WhatsAppStatusType;
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    origin?: {
      type: string;
    };
    expiration_timestamp?: string;
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
  errors?: Array<{
    code: number;
    title: string;
    message?: string;
    error_data?: {
      details: string;
    };
  }>;
}

export interface WhatsAppWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: "text" | "interactive" | "button" | "image" | "document" | "audio" | "unknown";
  text?: {
    body: string;
  };
}

export interface WhatsAppWebhookValue {
  messaging_product: "whatsapp";
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: Array<{
    profile: {
      name: string;
    };
    wa_id: string;
  }>;
  statuses?: WhatsAppWebhookStatus[];
  messages?: WhatsAppWebhookMessage[];
}

/** Aviso de mudanca na situacao de um modelo (`message_template_status_update`). */
export interface WhatsAppTemplateStatusValue {
  event: MetaTemplateStatus | string;
  message_template_id?: number | string;
  message_template_name?: string;
  message_template_language?: string;
  reason?: string | null;
}

export type WhatsAppWebhookChange =
  | { field: "messages"; value: WhatsAppWebhookValue }
  | { field: "message_template_status_update"; value: WhatsAppTemplateStatusValue }
  | { field: string; value: unknown };

export interface WhatsAppWebhookEntry {
  id: string; // WABA ID
  changes: WhatsAppWebhookChange[];
}

export interface WhatsAppWebhookPayload {
  object: "whatsapp_business_account";
  entry: WhatsAppWebhookEntry[];
}
