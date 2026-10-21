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

export interface SendWhatsAppTemplateMessagePayload {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParameters?: string[];
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
