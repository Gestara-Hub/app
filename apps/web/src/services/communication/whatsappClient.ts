import {
  sendWhatsAppTextMessage as libSendText,
  sendWhatsAppTemplateMessage as libSendTemplate,
  normalizeWhatsAppNumber,
  getWhatsAppConfig,
  WhatsAppApiError,
  type WhatsAppMessageResponse,
  type WhatsAppTemplateComponent,
} from "@/lib/whatsapp";
import { logError } from "@/lib/log";

export { WhatsAppApiError };

/**
 * Cliente de alto nível para envio de mensagens via Meta WhatsApp Cloud API.
 * Fornece métodos tipados para envio de texto e modelos oficiais, validação
 * de credenciais e normalização de telefones brasileiros.
 */
export const whatsappClient = {
  /**
   * Verifica se as credenciais mínimas da Meta estão configuradas no ambiente.
   */
  isConfigured(): boolean {
    const config = getWhatsAppConfig();
    return Boolean(config.apiToken && config.phoneNumberId);
  },

  /**
   * Envia uma mensagem de texto livre via Meta Cloud API.
   * Válido dentro da janela de atendimento de 24 horas aberta pelo cliente.
   */
  async sendTextMessage(to: string, text: string): Promise<WhatsAppMessageResponse> {
    if (!text || !text.trim()) {
      throw new Error("O texto da mensagem não pode ser vazio.");
    }
    const cleanTo = normalizeWhatsAppNumber(to);
    if (!cleanTo) {
      throw new Error("Número de telefone do destinatário inválido.");
    }

    try {
      const response = await libSendText({ to: cleanTo, text });
      return response;
    } catch (error) {
      logError("[WhatsApp] Falha ao enviar mensagem de texto:", error);
      throw error;
    }
  },

  /**
   * Envia uma mensagem baseada em Modelo (Template) aprovado pela Meta.
   * Funciona a qualquer momento, sem depender da janela de 24h.
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    options: {
      languageCode?: string;
      bodyParameters?: string[];
      components?: WhatsAppTemplateComponent[];
    } = {},
  ): Promise<WhatsAppMessageResponse> {
    if (!templateName) {
      throw new Error("O nome do template é obrigatório.");
    }
    const cleanTo = normalizeWhatsAppNumber(to);
    if (!cleanTo) {
      throw new Error("Número de telefone do destinatário inválido.");
    }

    try {
      const response = await libSendTemplate({
        to: cleanTo,
        templateName,
        languageCode: options.languageCode || "pt_BR",
        bodyParameters: options.bodyParameters,
        components: options.components,
      });
      return response;
    } catch (error) {
      logError(`[WhatsApp] Falha ao enviar template '${templateName}':`, error);
      throw error;
    }
  },

  /**
   * Normaliza o telefone para o formato padrão Meta Cloud API (apenas dígitos com DDI 55).
   */
  normalizePhone(phone: string): string {
    return normalizeWhatsAppNumber(phone);
  },
};
