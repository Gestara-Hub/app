"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  Id,
  MessageTrigger,
  SendMessagePayload,
  UpdateConnectionSettingsPayload,
  UpdateTemplatePayload,
} from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { queryKeys } from "@/lib/queryKeys";
import { fillMessage, whatsappLink, whatsappNumber } from "@/lib/whatsapp";
import { clientsService } from "@/services/clientsService";
import { communicationService } from "@/services/communicationService";
import { useOrganization } from "@/features/settings";

function useInvalidateCommunication() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.communication.all });
    // Ultimas mensagens na ficha do aluno.
    qc.invalidateQueries({ queryKey: queryKeys.clients.summaries });
  };
}

export function useWhatsAppConnection() {
  return useQuery({
    queryKey: queryKeys.communication.session,
    queryFn: () => communicationService.getConnection(),
  });
}

export function useConnectOfficialWhatsApp() {
  const invalidate = useInvalidateCommunication();
  return useMutation({ mutationFn: () => communicationService.connectOfficial(), onSuccess: invalidate });
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

export function useMessageLogs(filter?: { trigger?: string; status?: string; search?: string; clientId?: Id }) {
  return useQuery({
    queryKey: queryKeys.communication.logs(filter),
    queryFn: () => communicationService.listLogs(filter),
  });
}

export function useRetryMessage() {
  const invalidate = useInvalidateCommunication();
  return useMutation({ mutationFn: (id: Id) => communicationService.retryFailedMessage(id), onSuccess: invalidate });
}

/** Alunos ativos para escolher o destinatario (mesmo cache da lista de alunos). */
export function useMessageRecipients() {
  return useQuery({
    queryKey: queryKeys.clients.list({ status: "active" }),
    queryFn: () => clientsService.list({ status: "active" }),
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
  recipient: { name: string; phone?: string; clientId?: Id };
  /** Valores das variaveis do modelo; {aluno} e {empresa} vem sozinhos. */
  values?: Record<string, string | undefined>;
  /** Texto pronto (dispensa o modelo), ex.: mensagem avulsa. */
  content?: string;
  chargeId?: Id;
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

  function compose(trigger: MessageTrigger, values: WhatsAppSendInput["values"] = {}, name = ""): string {
    const template = templates?.find((t) => t.trigger === trigger);
    if (!template) return "";
    return fillMessage(template.content, { aluno: name, empresa: organization?.name, ...values });
  }

  function sendMessage(input: WhatsAppSendInput): void {
    const phone = whatsappNumber(input.recipient.phone);
    if (!phone) {
      toast.error(`${input.recipient.name || "O aluno"} não tem um WhatsApp com DDD no cadastro.`);
      return;
    }
    const content = (input.content ?? compose(input.trigger, input.values, input.recipient.name)).trim();
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
    };
    if (mode === "official") {
      // Promessa em vez do callback do `mutate`: quem chamou costuma fechar o
      // dialogo na hora, e o callback por chamada nao roda depois de desmontar.
      send
        .mutateAsync(payload)
        .then(() => toast.success(`Mensagem enviada para ${input.recipient.name}.`))
        .catch((err: unknown) => toast.error(getErrorMessage(err, "Não foi possível enviar a mensagem.")));
      return;
    }
    window.open(whatsappLink(phone, content), "_blank", "noopener,noreferrer");
    register.mutate(payload);
  }

  return {
    mode,
    /** Modelos carregados: os botoes podem montar a mensagem. */
    ready: Boolean(templates && organization),
    isSending: send.isPending,
    compose,
    send: sendMessage,
  };
}
