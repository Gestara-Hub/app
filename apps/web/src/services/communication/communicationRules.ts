import {
  type ApiErrorField,
  type MessageCategory,
  type MessageLog,
  type MessageTemplate,
  type MessageTrigger,
  type MetaTemplateSend,
  type SendMessagePayload,
  type WhatsAppConnection,
  type WhatsAppConnectionView,
} from "@gestarahub/contracts";
import { format } from "date-fns";
import { isBirthdayToday } from "@/lib/birthdays";
import {
  MESSAGE_MAX_LENGTH,
  fillMessage,
  isManualTrigger,
  whatsappNumber,
} from "@/lib/whatsapp";
import {
  masterContent,
  masterParams,
  masterTemplateFor,
  paymentButtonSuffix,
} from "@/lib/whatsapp/master-templates";
import { chargeReference } from "@/lib/messages/message-values";
import { charCount } from "@/lib/text";
import { newId, nowIso, persistLocal, validationError } from "@/services/world/ops";
import { defaultMessageTemplates, defaultWhatsAppConnection } from "@/services/defaults";
import { chargeInvoiceUrl, paymentPageUrl } from "@/lib/payment-page";
import { inServerWorld, store } from "@/services/world/store";
import { afterWorldCommit } from "@/services/world/effects";
import { tenantHasFeature } from "../subscription/subscriptionService";
import { dateInSpace } from "@gestarahub/core/date";
import { whatsappConsentGranted } from "../clients/clientConsentRules";
import { metaSignupConfigured, platformNumberFallbackAllowed } from "./whatsappCredentialsGateway";

/**
 * Comunicacao pelo WhatsApp do proprio espaco (docs/product/13, secao 5):
 * envio assistido no gratis (o aparelho abre o WhatsApp com o texto; aqui so
 * registramos "Aberto no WhatsApp") e envio automatico pela API oficial no Pro.
 */

/**
 * Apoio da comunicacao: conexao, modelos e historico do espaco, categoria do gatilho, validacao e parabens do dia.
 */

export function ensureConnection(): WhatsAppConnection {
  if (!store.whatsAppConnection) {
    store.whatsAppConnection = defaultWhatsAppConnection(store.organization.id);
  }
  return store.whatsAppConnection;
}

/**
 * O envio automatico pode ser ligado? Cada espaco conecta o proprio numero
 * pelo cadastro guiado da Meta (doc technical/07 §1.1): em producao, so com
 * ele configurado. Fora de producao (e no servidor do e2e) tambem vale o
 * numero de testes do ambiente, que so alcanca os numeros cadastrados como
 * teste. Nada sai pelo numero da plataforma em producao (decisao de 30/10/2026).
 */
export function officialSendingAvailable(): boolean {
  return platformNumberFallbackAllowed() || metaSignupConfigured();
}

export function connectionView(): WhatsAppConnectionView {
  const connection = ensureConnection();
  const canUseOfficial = tenantHasFeature("messaging");
  const officialAvailable = officialSendingAvailable();

  // Sem franquia desde 17/11/2026: o espaco paga a Meta direto pela propria
  // conta do WhatsApp (doc technical/07 §1.5); o GestaraHub nao limita os envios.
  return {
    ...connection,
    canUseOfficial,
    officialAvailable,
    mode: canUseOfficial && officialAvailable && connection.officialStatus === "connected" ? "official" : "assisted",
  };
}

export function ensureTemplates(): MessageTemplate[] {
  const defaults = defaultMessageTemplates(store.organization.id, store.organization.classSegment);
  if (!store.messageTemplates || store.messageTemplates.length === 0) {
    store.messageTemplates = defaults;
    return store.messageTemplates;
  }
  // Modelo novo da plataforma (ex.: chamar de volta o experimental, 09/11/2026):
  // o espaco antigo ganha o padrao sem perder o que ja tem.
  for (const template of defaults) {
    if (!store.messageTemplates.some((t) => t.trigger === template.trigger)) store.messageTemplates.push(template);
  }
  // Modelos mestres (18/11/2026, doc technical/07 §1.7): o texto vem sempre do
  // mestre (o espaco nao edita o texto do aviso), e o modelo antigo na Meta
  // (nome sem versao) deixa de valer ate a sincronizacao criar o novo.
  for (const template of store.messageTemplates) {
    const master = masterTemplateFor(template.trigger);
    if (!master) continue;
    const content = masterContent(master);
    if (template.content !== content) template.content = content;
    if (template.availableVariables.join() !== master.variables.join()) template.availableVariables = [...master.variables];
    if (template.metaTemplateName && template.metaTemplateName !== master.metaName) {
      delete template.metaTemplateName;
      delete template.metaTemplateId;
      delete template.metaBody;
      delete template.metaStatus;
      delete template.metaRejectionReason;
    }
  }
  return store.messageTemplates;
}

export function ensureLogs(): MessageLog[] {
  if (!store.messageLogs) store.messageLogs = [];
  return store.messageLogs;
}

export const TRIGGER_CATEGORY: Record<MessageTrigger, MessageCategory> = {
  billing_before_due: "billing",
  billing_due_date: "billing",
  billing_after_due: "billing",
  billing_critical: "billing",
  charge_reminder: "billing",
  payment_received: "billing",
  welcome_student: "retention",
  absence_alert: "retention",
  birthday_greeting: "retention",
  package_ending: "retention",
  level_up: "retention",
  trial_follow_up: "retention",
  event_reminder: "administrative",
  class_canceled: "administrative",
  schedule_change: "administrative",
  holiday_notice: "administrative",
  manual_broadcast: "administrative",
};

export function categoryOf(trigger?: MessageTrigger): MessageCategory {
  return trigger ? TRIGGER_CATEGORY[trigger] : "administrative";
}

/** Lembretes de cobranca: os que contam no valor recuperado. */
export function isBillingReminder(trigger: MessageTrigger): boolean {
  return trigger.startsWith("billing") || trigger === "charge_reminder";
}

export function validateMessage(payload: SendMessagePayload): void {
  const fields: ApiErrorField[] = [];
  if (!payload.recipientName.trim()) fields.push({ field: "recipientName", message: "Informe o destinatário." });
  if (!whatsappNumber(payload.recipientPhone)) {
    fields.push({ field: "recipientPhone", message: "Informe um WhatsApp com DDD." });
  }
  if (!payload.content.trim()) fields.push({ field: "content", message: "Escreva a mensagem." });
  // Emoji conta 1, como no contador da tela (ALU-38).
  else if (charCount(payload.content.trim()) > MESSAGE_MAX_LENGTH) {
    fields.push({ field: "content", message: `Use no máximo ${MESSAGE_MAX_LENGTH} caracteres.` });
  }
  if (fields.length > 0) throw validationError(fields);
}

export function newLog(payload: SendMessagePayload, status: MessageLog["status"], idOverride?: string): MessageLog {
  return {
    id: idOverride ?? newId(),
    organizationId: store.organization.id,
    recipientName: payload.recipientName.trim(),
    recipientPhone: whatsappNumber(payload.recipientPhone) ?? payload.recipientPhone.replace(/\D/g, ""),
    trigger: payload.trigger ?? "manual_broadcast",
    category: categoryOf(payload.trigger),
    content: payload.content.trim(),
    status,
    ...(payload.clientId ? { clientId: payload.clientId } : {}),
    ...(payload.chargeId ? { chargeId: payload.chargeId } : {}),
    sentAt: nowIso(),
  };
}

/**
 * Variaveis que o espaco nunca preenche: a frase delas fica fora do modelo da
 * Meta, onde toda variavel e obrigatoria. `{link_app}` ainda nao existe; o
 * link do pagamento so com o pagamento online ligado.
 */
/**
 * Modelo aprovado da Meta para a mensagem (doc technical/07 §1.7): o modelo
 * mestre do aviso, so quando a mensagem e o texto do espaco com esses valores
 * (texto editado sai como texto livre) e toda variavel tem valor (a Meta recusa
 * variavel vazia). Nos avisos de cobranca, o botao "Pagar agora" leva a pagina
 * de pagamento do aluno; sem ela, nao ha modelo.
 */
export function officialTemplateFor(
  trigger: MessageTrigger | undefined,
  content: string,
  variables: Record<string, string | undefined> | undefined,
): MetaTemplateSend | undefined {
  const master = masterTemplateFor(trigger);
  if (!master || !variables) return undefined;
  const template = ensureTemplates().find((t) => t.trigger === trigger);
  if (!template) return undefined;
  if (template.metaStatus === "REJECTED" || template.metaStatus === "DISABLED") return undefined;
  if (fillMessage(template.content, variables) !== content.trim()) return undefined;
  const params = masterParams(master, variables);
  if (!params) return undefined;
  if (master.paymentButton) {
    const suffix = paymentButtonSuffix(variables.link_pagamento);
    if (!suffix) return undefined;
    return { name: master.metaName, language: "pt_BR", params, buttonUrlSuffix: suffix };
  }
  return { name: master.metaName, language: "pt_BR", params };
}

/**
 * Envio oficial de um registro: no servidor, nasce "Na fila" e a Meta e
 * chamada depois da gravacao e da resposta (`messageDelivery.ts`); fora dele
 * (demonstracao e testes), fica "Entregue" como antes.
 */
export function dispatchOfficial(log: MessageLog): void {
  const deliver = queuedMessageDeliverer;
  const job: QueuedMessageJob = {
    logId: log.id,
    organizationId: log.organizationId,
    phone: log.recipientPhone,
    content: log.content,
    ...(log.metaTemplate ? { template: log.metaTemplate } : {}),
  };
  // A fila de efeitos so existe no servidor, durante a gravacao do espaco.
  if (deliver && afterWorldCommit(() => deliver(job))) {
    log.status = "queued";
  } else if (deliver && inServerWorld()) {
    // Sem efeito depois da gravacao (nao deveria acontecer no servidor): envia agora.
    log.status = "sent";
    void deliver(job);
  } else {
    log.status = "delivered";
  }
}

/**
 * Parabens automatico (so no envio oficial): no dia do aniversario, a partir
 * do horario da regra, uma mensagem por aluno por dia. Roda na rotina de hora
 * em hora (`birthdayGreetingsCron.ts`), nao mais na leitura do historico: antes
 * so saia se alguem abrisse a tela de mensagens, e a leitura gravava.
 */
export function runBirthdayGreetings(): number {
  if (!tenantHasFeature("messaging") || connectionView().mode !== "official") return 0;
  const template = ensureTemplates().find((t) => t.trigger === "birthday_greeting");
  if (!template?.enabled) return 0;
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  if (format(now, "HH:mm") < template.sendHour) return 0;

  const logs = ensureLogs();
  let sent = 0;
  for (const client of store.clients) {
    if (client.status !== "active" || !whatsappNumber(client.phone)) continue;
    // Sem a autorizacao do aluno, o automatico nao sai (doc product/27 M1).
    if (!whatsappConsentGranted(client)) continue;
    if (!isBirthdayToday(client.birthDate, today)) continue;
    const alreadySent = logs.some(
      (log) =>
        log.trigger === "birthday_greeting" &&
        log.clientId === client.id &&
        dateInSpace(log.sentAt) === today,
    );
    if (alreadySent) continue;
    const variables = { aluno: client.name, empresa: store.organization.name };
    const content = fillMessage(template.content, variables);
    const log = newLog(
      {
        recipientName: client.name,
        recipientPhone: client.phone ?? "",
        trigger: "birthday_greeting",
        clientId: client.id,
        content,
      },
      "delivered",
    );
    const metaTemplate = officialTemplateFor("birthday_greeting", content, variables);
    if (metaTemplate) log.metaTemplate = metaTemplate;
    dispatchOfficial(log);
    logs.unshift(log);
    sent += 1;
  }
  if (sent > 0) {
    persistLocal();
  }
  return sent;
}

/**
 * Lembretes automáticos de cobrança pelo WhatsApp oficial:
 * - Antes do vencimento (`billing_before_due`, padrão -3 dias)
 * - No dia do vencimento (`billing_due_date`, 0 dias)
 * - Após o vencimento (`billing_after_due`, padrão 3 dias)
 * Respeita o horário de envio permitido (`allowedSendHours`) e o horário da regra (`sendHour`).
 */
export function runBillingReminders(): number {
  if (!tenantHasFeature("messaging") || connectionView().mode !== "official") return 0;
  const connection = ensureConnection();
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const currentHour = format(now, "HH:mm");

  if (connection.allowedSendHours) {
    if (currentHour < connection.allowedSendHours.start || currentHour > connection.allowedSendHours.end) {
      return 0;
    }
  }

  const templates = ensureTemplates().filter(
    (t) => t.enabled && isBillingReminder(t.trigger) && !isManualTrigger(t.trigger),
  );
  if (templates.length === 0) return 0;

  const logs = ensureLogs();
  let sent = 0;

  for (const template of templates) {
    if (currentHour < template.sendHour) continue;

    const offset =
      template.daysOffset ??
      (template.trigger === "billing_before_due" || template.trigger === "charge_reminder"
        ? -3
        : template.trigger === "billing_after_due"
          ? 3
          : template.trigger === "billing_critical"
            ? 10
            : 0);

    const targetDateObj = new Date(now.getTime() - offset * 86_400_000);
    const targetDueDate = format(targetDateObj, "yyyy-MM-dd");

    // Mensalidade segue os lembretes proprios (`billing_*`); avulsa, curso,
    // pacote e evento usam `charge_reminder`; aula avulsa nao recebe lembrete.
    const wantsOtherCharges = template.trigger === "charge_reminder";
    const targetCharges = (store.charges ?? []).filter((c) => {
      if (c.status !== "pending" && c.status !== "overdue") return false;
      if (c.dueDate !== targetDueDate) return false;
      if (c.kind === "dropin") return false;
      return wantsOtherCharges ? c.kind !== "membership" : c.kind === "membership";
    });

    for (const charge of targetCharges) {
      const client = (store.clients ?? []).find((cl) => cl.id === charge.studentId);
      if (!client || client.status !== "active" || !whatsappNumber(client.phone)) continue;
      // Sem a autorizacao do aluno, o automatico nao sai (doc product/27 M1).
      if (!whatsappConsentGranted(client)) continue;

      const alreadySent = logs.some(
        (log) =>
          log.chargeId === charge.id &&
          log.trigger === template.trigger &&
          dateInSpace(log.sentAt) === today,
      );
      if (alreadySent) continue;

      const [y, m, d] = charge.dueDate.split("-");
      const formattedDueDate = `${d}/${m}/${y}`;
      const amountFormatted = (charge.amountCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

      const onlinePayment = (store.onlinePayments ?? []).find(
        (p) => p.chargeId === charge.id && p.status !== "canceled" && p.status !== "expired",
      );
      // Sempre a pagina do GestaraHub: o botao "Pagar agora" do modelo leva a ela.
      // Sem recebimentos online, a pagina da cobranca avisa para combinar com o
      // espaco (doc technical/07 §1.7).
      const paymentLink = onlinePayment?.publicCode
        ? paymentPageUrl(onlinePayment.publicCode)
        : chargeInvoiceUrl(charge.id);

      const className = charge.classGroupId
        ? (store.classGroups ?? []).find((cg) => cg.id === charge.classGroupId)?.name
        : undefined;
      const variables = {
        aluno: client.name,
        valor: amountFormatted,
        vencimento: formattedDueDate,
        empresa: store.organization.name,
        link_pagamento: paymentLink,
        referencia: chargeReference({
          kind: charge.kind,
          description: charge.description,
          className,
          cycleIndex: charge.cycleIndex,
          cycleTotal: charge.cycleTotal,
        }),
      };
      const content = fillMessage(template.content, variables);

      const log = newLog(
        {
          recipientName: client.name,
          recipientPhone: client.phone ?? "",
          trigger: template.trigger,
          clientId: client.id,
          chargeId: charge.id,
          content,
        },
        "delivered",
      );
      const metaTemplate = officialTemplateFor(template.trigger, content, variables);
      if (metaTemplate) log.metaTemplate = metaTemplate;
      dispatchOfficial(log);
      logs.unshift(log);
      sent += 1;
    }
  }

  if (sent > 0) {
    persistLocal();
  }
  return sent;
}

// --- Fila de envio (oficial) -------------------------------------------------

/** O que o efeito depois da gravacao precisa para entregar uma mensagem "Na fila". */
export interface QueuedMessageJob {
  logId: string;
  organizationId: string;
  phone: string;
  content: string;
  /** Modelo aprovado da Meta; sem ele, texto livre (janela de 24 horas). */
  template?: MetaTemplateSend;
}

let queuedMessageDeliverer: ((job: QueuedMessageJob) => Promise<void>) | null = null;

/** Registrado pelo servidor (`messageDelivery.ts`); no navegador e nos testes fica vazio. */
export function setQueuedMessageDeliverer(fn: ((job: QueuedMessageJob) => Promise<void>) | null): void {
  queuedMessageDeliverer = fn;
}

export function getQueuedMessageDeliverer(): ((job: QueuedMessageJob) => Promise<void>) | null {
  return queuedMessageDeliverer;
}
