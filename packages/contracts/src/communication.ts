import type { DateTimeISO, Id } from "./common";
import type { PaginationParams } from "./pagination";

/**
 * WhatsApp sempre com o numero do proprio espaco (docs/product/13, secao 5).
 * - `assisted` (gratis): o botao abre o WhatsApp do aparelho com a mensagem
 *   pronta (`wa.me`); a pessoa so toca em enviar.
 * - `official` (Pro, recurso `messaging`): o numero do espaco conectado a API
 *   oficial da Meta; o sistema envia sozinho.
 */
export type WhatsAppSendMode = "assisted" | "official";

/** Conexao do numero do espaco com a API oficial da Meta. */
export type WhatsAppOfficialStatus = "not_connected" | "pending" | "connected";

export interface WhatsAppConnection {
  organizationId: Id;
  officialStatus: WhatsAppOfficialStatus;
  /** Numero do espaco (so digitos, com DDI). */
  phoneNumber?: string;
  /** Nome exibido no WhatsApp (aprovado pela Meta). */
  displayName?: string;
  connectedAt?: DateTimeISO;
  /** Janela em que o envio automatico pode sair. */
  allowedSendHours: {
    start: string;
    end: string;
  };
  /** Franquia mensal do envio automatico (custo por mensagem da Meta). */
  monthlyQuota: {
    used: number;
    included: number;
    /** Inicio do ciclo atual da franquia (zera no pagamento do plano; no anual, todo mes). */
    cycleStart?: string;
  };
}

/** Leitura da conexao com o modo em uso (Pro e conectado = oficial). */
export interface WhatsAppConnectionView extends WhatsAppConnection {
  mode: WhatsAppSendMode;
  /** O plano tem envio automatico (recurso `messaging`). */
  canUseOfficial: boolean;
  /** Franquia mensal do plano esgotada no ciclo atual. */
  isQuotaExhausted: boolean;
  /**
   * O envio automatico pode sair neste ambiente. Falso em producao ate cada
   * espaco ter as credenciais do proprio numero (doc technical/07 §1.1):
   * decisao do usuario de 30/10/2026, nada sai pelo numero da plataforma.
   */
  officialAvailable: boolean;
}

export type MessageTrigger =
  | "billing_before_due"
  | "billing_due_date"
  | "billing_after_due"
  | "billing_critical"
  | "welcome_student"
  | "absence_alert"
  | "birthday_greeting"
  /** Cobranca avulsa, parcela de curso ou compra de pacote (doc 20, fase D). */
  | "charge_reminder"
  /** Pacote de aulas na ultima aula, perto de vencer ou vencido ha pouco. */
  | "package_ending"
  /**
   * Modelos so de envio manual (sem automatico): sugeridos na mensagem para o
   * aluno. Pagamento recebido e avanco aparecem pela situacao dele; os avisos
   * (aula cancelada, mudanca de horario, feriado) sempre.
   */
  | "payment_received"
  | "level_up"
  | "class_canceled"
  | "schedule_change"
  | "holiday_notice"
  | "manual_broadcast";

export type MessageCategory = "billing" | "retention" | "administrative";

export type MetaTemplateStatus = "APPROVED" | "PENDING" | "REJECTED" | "PAUSED";

export interface MetaTemplateInfo {
  name: string;
  status: MetaTemplateStatus;
  category: string;
  id: string;
  rejectionReason?: string;
}

export interface MessageTemplate {
  id: Id;
  organizationId: Id;
  trigger: MessageTrigger;
  category: MessageCategory;
  title: string;
  description: string;
  enabled: boolean;
  sendHour: string;
  daysOffset: number;
  content: string;
  availableVariables: string[];
  metaStatus?: MetaTemplateStatus;
  metaTemplateName?: string;
  updatedAt: DateTimeISO;
}

/** `opened`: envio assistido, o WhatsApp foi aberto com o texto (o envio em si nao e confirmado). */
export type MessageLogStatus = "opened" | "queued" | "sent" | "delivered" | "read" | "failed";

export interface MessageLog {
  id: Id;
  organizationId: Id;
  recipientName: string;
  recipientPhone: string;
  trigger: MessageTrigger;
  category: MessageCategory;
  content: string;
  status: MessageLogStatus;
  /** Aluno e cobranca ligados a mensagem (para medir o que foi recuperado). */
  clientId?: Id;
  chargeId?: Id;
  sentAt: DateTimeISO;
  readAt?: DateTimeISO;
  errorReason?: string;
}

export interface CommunicationMetrics {
  mode: WhatsAppSendMode;
  /** Mensagens do mes: abertas no WhatsApp (assistido) ou enviadas (oficial). */
  messagesThisMonth: number;
  monthlyQuota: number;
  /** So no oficial; `null` sem envios no mes. */
  deliveryRate: number | null;
  readRate: number | null;
  /** Mensalidades pagas no mes depois de um lembrete pelo WhatsApp. */
  recoveredAmountCents: number;
  activeAutomationsCount: number;
}

export interface SendMessagePayload {
  recipientName: string;
  recipientPhone: string;
  content: string;
  trigger?: MessageTrigger;
  clientId?: Id;
  chargeId?: Id;
}

export interface UpdateTemplatePayload {
  id: Id;
  enabled?: boolean;
  sendHour?: string;
  daysOffset?: number;
  content?: string;
}

export interface UpdateConnectionSettingsPayload {
  allowedSendHours?: {
    start: string;
    end: string;
  };
}

/** Tipo da mensagem no filtro do historico (agrupa gatilhos e categorias). */
export type MessageLogKind = "all" | "billing" | "retention" | "notices" | "manual";

export interface MessageLogFilter extends PaginationParams {
  trigger?: string;
  status?: string;
  search?: string;
  clientId?: Id;
  kind?: MessageLogKind;
}
