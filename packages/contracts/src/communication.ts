import type { DateISO, DateTimeISO, Id } from "./common";
import type { WhatsAppConsentStatus } from "./client";
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
   * O envio automatico pode ser ligado neste ambiente. Em producao, so com o
   * cadastro guiado da Meta configurado: cada espaco conecta o proprio numero
   * (doc technical/07 §1.1); nada sai pelo numero da plataforma.
   */
  officialAvailable: boolean;
}

/**
 * Como o numero entrou na API oficial pelo cadastro guiado da Meta:
 * `cloud` (numero novo, so na API, registrado com PIN) ou `coexistence`
 * (o espaco segue usando o app WhatsApp Business no mesmo numero).
 */
export type WhatsAppOnboarding = "cloud" | "coexistence";

/** O que o cadastro guiado da Meta devolve ao conectar o numero do espaco. */
export interface ConnectOfficialWhatsAppPayload {
  /** Codigo de uso unico que o servidor troca pelo token do espaco. */
  code?: string;
  phoneNumberId?: string;
  wabaId?: string;
  businessId?: string;
  onboarding?: WhatsAppOnboarding;
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
  /** Aluno experimental que nao voltou: chamar de volta (09/11/2026). */
  | "trial_follow_up"
  /** Inscrito num evento que acontece amanha (doc product/29 e 25, 09/11/2026). */
  | "event_reminder"
  | "class_canceled"
  | "schedule_change"
  | "holiday_notice"
  | "manual_broadcast";

export type MessageCategory = "billing" | "retention" | "administrative";

export type MetaTemplateStatus = "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED";

export interface MetaTemplateInfo {
  name: string;
  status: MetaTemplateStatus;
  category: string;
  id: string;
  language?: string;
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
  /** Situacao do modelo na conta do WhatsApp do espaco (doc technical/07 §1.4). */
  metaStatus?: MetaTemplateStatus;
  metaTemplateName?: string;
  /** Id do modelo na Meta (para editar o texto). */
  metaTemplateId?: string;
  /** Texto enviado a Meta, com as variaveis do GestaraHub; o envio usa o mesmo. */
  metaBody?: string;
  metaRejectionReason?: string;
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
  /**
   * Modelo aprovado da Meta usado no envio oficial (nome, idioma e variaveis
   * em ordem). Sem ele, o envio oficial e texto livre: so na janela de 24
   * horas da ultima mensagem do aluno (doc technical/07 §3.3).
   */
  metaTemplate?: MetaTemplateSend;
}

/** Envio por modelo aprovado: as variaveis seguem a ordem em que aparecem no texto. */
export interface MetaTemplateSend {
  name: string;
  language: string;
  params: string[];
}

export interface CommunicationMetrics {
  mode: WhatsAppSendMode;
  /** Mensagens do mes: abertas no WhatsApp (assistido) ou enviadas (oficial). */
  messagesThisMonth: number;
  monthlyQuota: number;
  /** So no oficial; `null` sem envios no mes. */
  deliveryRate: number | null;
  readRate: number | null;
  /** Quantidade absoluta de envios considerados nas taxas do mes (oficial). */
  sentCount?: number;
  /** Mensagens entregues ou lidas no mes (oficial). */
  deliveredCount?: number;
  /** Mensagens lidas no mes (oficial). */
  readCount?: number;
  /** Mensagens com falha no mes atual. */
  failedCount?: number;
  /** Mensagens na fila ou enviadas aguardando confirmacao de entrega no mes. */
  inProgressCount?: number;
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
  /**
   * Valores das variaveis do modelo (sem chaves: `aluno`, `valor`...). No
   * oficial, com o texto igual ao do modelo, a mensagem sai pelo modelo
   * aprovado da Meta; texto editado sai como texto livre.
   */
  variables?: Record<string, string | undefined>;
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
  dateFrom?: DateISO;
  dateTo?: DateISO;
}

/** Aluno elegivel no compositor de nova mensagem (dados minimos + autorizacao de WhatsApp). */
export interface MessageRecipientOption {
  id: Id;
  name: string;
  phone?: string;
  whatsappConsentStatus?: WhatsAppConsentStatus;
}

/** Turma ativa com alunos matriculados para selecao rapida em "Nova mensagem". */
export interface MessageClassGroupOption {
  id: Id;
  name: string;
  studentIds: Id[];
}

/** Contexto do compositor de "Nova mensagem" e resumo de autorizacoes do espaco. */
export interface MessageComposerContext {
  recipients: MessageRecipientOption[];
  classGroups: MessageClassGroupOption[];
  activeStudentsCount: number;
  consentedCount: number;
  missingConsentCount: number;
  revokedConsentCount: number;
}
