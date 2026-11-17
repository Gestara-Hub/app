import type { MetaTemplateSend } from "@gestarahub/contracts";
import {
  sendWhatsAppTextMessage as libSendText,
  sendWhatsAppTemplateMessage as libSendTemplate,
  listWhatsAppTemplates as libListTemplates,
  createOrUpdateWhatsAppTemplate as libCreateOrUpdateTemplate,
  editWhatsAppTemplate as libEditTemplate,
  getWhatsAppPhoneNumberDetails as libGetPhoneNumberDetails,
  normalizeWhatsAppNumber,
  getWhatsAppConfig,
  WhatsAppApiError,
  type MetaPhoneNumberDetails,
  type MetaTemplateInfo,
  type MetaTemplateStatus,
  type WhatsAppConfig,
  type WhatsAppMessageResponse,
  type WhatsAppTemplateComponent,
} from "@/lib/whatsapp";
import { logError } from "@/lib/log";
import { getWhatsAppCredentialsGateway, platformNumberFallbackAllowed } from "./whatsappCredentialsGateway";

export { WhatsAppApiError };
export type { MetaTemplateInfo, MetaTemplateStatus };

/**
 * Configuracao da Meta de um espaco: as credenciais do proprio numero (doc
 * technical/07 §1.1); sem elas, o numero do ambiente so fora de producao.
 */
export type SpaceWhatsAppConfig = Partial<WhatsAppConfig>;

/**
 * Cliente de alto nivel da Meta WhatsApp Cloud API. Cada chamada leva a
 * configuracao do espaco (`configFor`), nunca so o ambiente.
 */
export const whatsappClient = {
  /**
   * Configuracao do espaco para chamar a Meta, ou null quando o espaco nao
   * pode enviar pela API (sem credencial e sem o numero de testes do ambiente).
   */
  async configFor(organizationId: string): Promise<SpaceWhatsAppConfig | null> {
    const gateway = getWhatsAppCredentialsGateway();
    if (gateway) {
      const own = await gateway.configFor(organizationId);
      if (own) return own;
    }
    if (!platformNumberFallbackAllowed()) return null;
    const env = getWhatsAppConfig();
    return env.apiToken && env.phoneNumberId ? {} : null;
  },

  /**
   * Mensagem de texto livre. A Meta so aceita dentro da janela de 24 horas
   * aberta pela ultima mensagem do aluno.
   */
  async sendTextMessage(to: string, text: string, config: SpaceWhatsAppConfig): Promise<WhatsAppMessageResponse> {
    if (!text || !text.trim()) {
      throw new Error("O texto da mensagem não pode ser vazio.");
    }
    const cleanTo = normalizeWhatsAppNumber(to);
    if (!cleanTo) {
      throw new Error("Número de telefone do destinatário inválido.");
    }
    try {
      return await libSendText({ to: cleanTo, text }, config);
    } catch (error) {
      logError("[WhatsApp] Falha ao enviar mensagem de texto:", error);
      throw error;
    }
  },

  /** Mensagem por modelo aprovado pela Meta: sai a qualquer momento. */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    options: {
      languageCode?: string;
      bodyParameters?: string[];
      components?: WhatsAppTemplateComponent[];
    },
    config: SpaceWhatsAppConfig,
  ): Promise<WhatsAppMessageResponse> {
    if (!templateName) {
      throw new Error("O nome do template é obrigatório.");
    }
    const cleanTo = normalizeWhatsAppNumber(to);
    if (!cleanTo) {
      throw new Error("Número de telefone do destinatário inválido.");
    }
    try {
      return await libSendTemplate(
        {
          to: cleanTo,
          templateName,
          languageCode: options.languageCode || "pt_BR",
          bodyParameters: options.bodyParameters,
          components: options.components,
        },
        config,
      );
    } catch (error) {
      logError(`[WhatsApp] Falha ao enviar template '${templateName}':`, error);
      throw error;
    }
  },

  /** Telefone no formato da Meta (so digitos, com DDI 55). */
  normalizePhone(phone: string): string {
    return normalizeWhatsAppNumber(phone);
  },

  /** Modelos da conta do espaco na Meta, com a situacao (aprovado, em analise, recusado, pausado). */
  async listTemplates(config: SpaceWhatsAppConfig): Promise<MetaTemplateInfo[]> {
    try {
      return await libListTemplates(config);
    } catch (err) {
      logError("[WhatsApp] Erro ao listar templates da Meta:", err);
      return [];
    }
  },

  /** Cria ou atualiza um modelo na conta do espaco na Meta. */
  async createOrUpdateTemplate(
    payload: {
      name: string;
      category: "UTILITY" | "MARKETING";
      content: string;
      languageCode?: string;
    },
    config: SpaceWhatsAppConfig,
  ): Promise<{ id: string; status: MetaTemplateStatus }> {
    return libCreateOrUpdateTemplate(payload, config);
  },

  /** Edita o texto de um modelo que ja existe na conta do espaco (a Meta analisa de novo). */
  async editTemplate(
    templateId: string,
    content: string,
    config: SpaceWhatsAppConfig,
  ): Promise<{ id: string; status: MetaTemplateStatus }> {
    return libEditTemplate(templateId, content, config);
  },

  /** Numero e nome verificados na Meta. */
  async getPhoneNumberDetails(phoneNumberId: string, config: SpaceWhatsAppConfig): Promise<MetaPhoneNumberDetails | null> {
    return libGetPhoneNumberDetails(phoneNumberId, config);
  },
};

/**
 * Envio oficial de uma mensagem: pelo modelo aprovado da Meta quando ha um
 * (mensagem que o espaco inicia), senao texto livre (so na janela de 24 horas).
 */
export function sendOfficial(
  to: string,
  content: string,
  template: MetaTemplateSend | undefined,
  config: SpaceWhatsAppConfig,
): Promise<WhatsAppMessageResponse> {
  return template
    ? whatsappClient.sendTemplateMessage(
        to,
        template.name,
        { languageCode: template.language, bodyParameters: template.params },
        config,
      )
    : whatsappClient.sendTextMessage(to, content, config);
}

/** Motivo da falha da Meta para o Historico, em portugues (codigos da Cloud API). */
export function metaErrorReason(err: unknown): string {
  if (err instanceof WhatsAppApiError) {
    switch (err.code) {
      case 131047:
        return "Fora da janela de 24 horas: esta mensagem precisa de um modelo aprovado no WhatsApp.";
      case 132000:
        return "As informações da mensagem não batem com o modelo aprovado no WhatsApp.";
      case 132001:
        return "O modelo desta mensagem ainda não existe ou não foi aprovado no WhatsApp do espaço.";
      case 132015:
        return "O modelo desta mensagem está pausado pelo WhatsApp.";
      case 132016:
        return "O modelo desta mensagem foi desativado pelo WhatsApp.";
      case 131026:
        return "O número não recebe mensagens pelo WhatsApp.";
      case 131049:
        return "O WhatsApp não entregou para manter a qualidade das mensagens. Tente mais tarde.";
      case 131050:
        return "O aluno parou de receber mensagens deste espaço pelo WhatsApp.";
      case 190:
        return "A conexão com o WhatsApp expirou. Conecte de novo em Comunicação.";
      default:
        return `O WhatsApp recusou o envio (código ${err.code}): ${err.message}`;
    }
  }
  return err instanceof Error ? err.message : "Falha ao enviar mensagem de WhatsApp.";
}
