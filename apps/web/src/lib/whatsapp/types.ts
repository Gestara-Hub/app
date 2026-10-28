export interface WhatsAppConfig {
  apiUrl: string;
  apiToken: string;
  phoneNumberId: string;
  businessAccountId?: string;
}

export interface SendWhatsAppTextMessagePayload {
  to: string; // E.164 sem o '+' (ex: 5592991844219)
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
  index?: number;
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
    fbtrace_id: string;
  };
}

export type WhatsAppStatusType = "sent" | "delivered" | "read" | "failed";

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

export interface WhatsAppWebhookChange {
  value: WhatsAppWebhookValue;
  field: "messages";
}

export interface WhatsAppWebhookEntry {
  id: string; // WABA ID
  changes: WhatsAppWebhookChange[];
}

export interface WhatsAppWebhookPayload {
  object: "whatsapp_business_account";
  entry: WhatsAppWebhookEntry[];
}
