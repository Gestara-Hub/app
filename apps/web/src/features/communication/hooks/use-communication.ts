"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import type {
  ConnectOfficialWhatsAppPayload,
  Id,
  MessageLogFilter,
  MessageTrigger,
  SendMessagePayload,
  UpdateConnectionSettingsPayload,
  UpdateTemplatePayload,
} from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { queryKeys } from "@/lib/queryKeys";
import { fillMessage, openWhatsApp, whatsappLink, whatsappNumber } from "@/lib/whatsapp";
import { billingService } from "@/services/billing";
import { clientsService } from "@/services/clients";
import { communicationService, messageLogsPage } from "@/services/communication";
import { studentSummaryService } from "@/services/clients/studentSummaryService";
import { turmasService } from "@/services/classes";
import { useOrganization } from "@/features/settings";
import { confirmOfficialSend } from "../components/whatsapp-confirm-host";
import { ABSENCE_STREAK, messageSuggestions } from "../message-suggestions";
import { dateInSpace } from "@gestarahub/core/date";

function useInvalidateCommunication() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.communication.all });
    // Ultimas mensagens na ficha do aluno.
    qc.invalidateQueries({ queryKey: queryKeys.clients.summaries });
    qc.invalidateQueries({ queryKey: queryKeys.unit.detail });
    qc.invalidateQueries({ queryKey: queryKeys.organization.detail });
  };
}

export function useWhatsAppConnection(enabled = true) {
  return useQuery({
    queryKey: queryKeys.communication.session,
    queryFn: () => communicationService.getConnection(),
    enabled,
  });
}

export function useConnectOfficialWhatsApp() {
  const invalidate = useInvalidateCommunication();
  return useMutation({
    mutationFn: (payload?: ConnectOfficialWhatsAppPayload) =>
      communicationService.connectOfficial(payload),
    onSuccess: invalidate,
  });
}

/** Botao "Atualizar" da situacao na Meta (doc technical/07 §1.6). */
export function useRefreshMetaHealth() {
  const invalidate = useInvalidateCommunication();
  return useMutation({ mutationFn: () => communicationService.refreshMetaHealth(), onSuccess: invalidate });
}

export function useDisconnectOfficialWhatsApp() {
  const invalidate = useInvalidateCommunication();
  return useMutation({ mutationFn: () => communicationService.disconnectOfficial(), onSuccess: invalidate });
}

export function useUpdateConnectionSettings() {
  const invalidate = useInvalidateCommunication();
  return useMutation({
    mutationFn: (payload: UpdateConnectionSettingsPayload) => communicationService.updateConnectionSettings(payload),
    onSuccess: invalidate,
  });
}

export function useMessageTemplates() {
  return useQuery({
    queryKey: queryKeys.communication.templates,
    queryFn: () => communicationService.listTemplates(),
  });
}

export function useUpdateTemplate() {
  const invalidate = useInvalidateCommunication();
  return useMutation({
    mutationFn: (payload: UpdateTemplatePayload) => communicationService.updateTemplate(payload),
    onSuccess: invalidate,
  });
}

export function useMessageLogs(
  filter?: {
    trigger?: string;
    status?: string;
    search?: string;
    clientId?: Id;
    dateFrom?: string;
    dateTo?: string;
  },
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.communication.logs(filter),
    queryFn: () => communicationService.listLogs(filter),
    enabled,
  });
}

/** Uma pagina do historico de mensagens (filtros e paginacao no banco na conta real). */
export function useMessageLogsPage(filter: MessageLogFilter) {
  return useQuery({
    queryKey: queryKeys.communication.logsPage(filter),
    queryFn: () => messageLogsPage(filter),
    // Trocar de pagina mantem a lista atual ate a proxima chegar.
    placeholderData: keepPreviousData,
  });
}

export function useRetryMessage() {
  const invalidate = useInvalidateCommunication();
  return useMutation({ mutationFn: (id: Id) => communicationService.retryFailedMessage(id), onSuccess: invalidate });
}

/** Alunos ativos para escolher o destinatario: so nome e telefone (mesmo cache dos seletores). */
export function useMessageRecipients() {
  return useQuery({
    queryKey: queryKeys.clients.options({ status: "active" }),
    queryFn: () => clientsService.listOptions({ status: "active" }),
  });
}

/** Alunos com WhatsApp, turmas ativas e status de autorizacao para o compositor de mensagens. */
export function useMessageComposerContext(enabled = true) {
  return useQuery({
    queryKey: queryKeys.communication.composerContext,
    queryFn: () => communicationService.getComposerContext(),
    enabled,
    staleTime: 0,
  });
}

/**
 * Modelos sugeridos para o aluno escolhido, pela situacao dele. Usa as mesmas
 * consultas (e o mesmo cache) da ficha, de Cobrancas e do Dashboard; sem
 * aluno ou com alguma consulta indisponivel, sobram os avisos.
 */
export function useMessageSuggestions(clientId?: Id) {
  const enabled = Boolean(clientId);
  const id = clientId ?? "";
  const { data: summary } = useQuery({
    queryKey: queryKeys.clients.summary(id),
    queryFn: () => studentSummaryService.getStudentSummary(id),
    enabled,
  });
  const { data: charges } = useQuery({
    queryKey: queryKeys.billing.charges({ studentId: id }),
    queryFn: () => billingService.listCharges({ studentId: id }),
    enabled,
  });
  const { data: streaks } = useQuery({
    queryKey: queryKeys.classes.absenceStreaks,
    queryFn: () => turmasService.listAbsenceStreaks(ABSENCE_STREAK),
    enabled,
  });
  if (!clientId) return [];
  return messageSuggestions({
    today: dateInSpace(),
    summary,
    charges,
    absenceStreak: streaks?.find((s) => s.studentId === clientId)?.streak ?? 0,
  });
}

export function useCommunicationMetrics() {
  return useQuery({
    queryKey: queryKeys.communication.metrics,
    queryFn: () => communicationService.getMetrics(),
  });
}

export interface WhatsAppSendInput {
  trigger: MessageTrigger;
  /** `aboutStudent`: o destinatario e o responsavel de um aluno menor; o texto abre falando do aluno. */
  recipient: { name: string; phone?: string; clientId?: Id; aboutStudent?: string };
  /** Valores das variaveis do modelo; {aluno} e {empresa} vem sozinhos. */
  values?: Record<string, string | undefined>;
  /** Texto pronto (dispensa o modelo), ex.: mensagem avulsa. */
  content?: string;
  chargeId?: Id;
  /** O usuario ja viu e revisou o texto (dialogo de mensagem): no oficial, envia sem perguntar. */
  reviewed?: boolean;
}

/**
 * Envia pelo WhatsApp do proprio espaco. No envio assistido (gratis), abre o
 * WhatsApp do aparelho com o texto pronto e registra "Aberto no WhatsApp"; no
 * oficial (Pro conectado), envia sozinho pela API. A aba abre no proprio
 * clique (sem bloqueio de pop-up); o registro vai depois.
 */
export function useWhatsAppSend() {
  const { data: connection } = useWhatsAppConnection();
  const { data: templates } = useMessageTemplates();
  const { data: organization } = useOrganization();
  const invalidate = useInvalidateCommunication();
  const register = useMutation({
    mutationFn: (payload: SendMessagePayload) => communicationService.registerAssistedMessage(payload),
    onSuccess: invalidate,
  });
  const send = useMutation({
    mutationFn: (payload: SendMessagePayload) => communicationService.sendMessage(payload),
    onSuccess: invalidate,
  });
  const mode = connection?.mode ?? "assisted";

  function compose(
    trigger: MessageTrigger,
    values: WhatsAppSendInput["values"] = {},
    name = "",
    aboutStudent?: string,
  ): string {
    const template = templates?.find((t) => t.trigger === trigger);
    if (!template) return "";
    const text = fillMessage(template.content, { aluno: name, empresa: organization?.name, ...values });
    return aboutStudent && text ? `Sobre ${aboutStudent}:\n${text}` : text;
  }

  function sendMessage(input: WhatsAppSendInput): void {
    const phone = whatsappNumber(input.recipient.phone);
    if (!phone) {
      toast.error(`${input.recipient.name || "O aluno"} não tem um WhatsApp com DDD no cadastro.`);
      return;
    }
    const content = (input.content ?? compose(input.trigger, input.values, input.recipient.name, input.recipient.aboutStudent)).trim();
    if (!content) {
      toast.error("Não foi possível montar a mensagem. Confira o modelo em Comunicação.");
      return;
    }
    const payload: SendMessagePayload = {
      recipientName: input.recipient.name,
      recipientPhone: phone,
      content,
      trigger: input.trigger,
      clientId: input.recipient.clientId,
      chargeId: input.chargeId,
      // No oficial, texto igual ao do modelo sai pelo modelo aprovado da Meta (o servidor confere).
      variables: { aluno: input.recipient.name, empresa: organization?.name, ...input.values },
    };
    if (mode === "official") {
      // A API envia sozinha: um toque num aviso nunca manda direto, confirma
      // vendo o texto. Promessa em vez do callback do `mutate`: quem chamou
      // costuma fechar o dialogo na hora, e o callback nao roda depois de desmontar.
      const confirmed = input.reviewed ? Promise.resolve(true) : confirmOfficialSend(input.recipient.name, content);
      void confirmed.then((ok) => {
        if (!ok) return;
        send
          .mutateAsync(payload)
          .then((log) =>
            toast.success(
              log.status === "queued"
                ? `Mensagem para ${input.recipient.name} na fila de envio.`
                : `Mensagem enviada para ${input.recipient.name}.`,
            ),
          )
          .catch((err: unknown) => toast.error(getErrorMessage(err, "Não foi possível enviar a mensagem.")));
      });
      return;
    }
    // Registro antes de sair: no app instalado o WhatsApp abre na mesma janela.
    register.mutate(payload);
    openWhatsApp(whatsappLink(phone, content));
  }

  return {
    mode,
    connection,
    /** Modelos carregados: os botoes podem montar a mensagem. */
    ready: Boolean(templates && organization),
    /** O modelo esta ligado em Comunicacao (os envios automaticos respeitam o desligado). */
    enabled: (trigger: MessageTrigger) => templates?.find((t) => t.trigger === trigger)?.enabled !== false,
    isSending: send.isPending,
    compose,
    send: sendMessage,
    /** Disparo direto pela API oficial (para lote apos confirmacao unica no dialogo). */
    sendOfficialDirect: (payload: SendMessagePayload) => send.mutateAsync(payload),
  };
}
