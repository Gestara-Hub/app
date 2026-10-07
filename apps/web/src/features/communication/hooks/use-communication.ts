import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Id,
  SendMessagePayload,
  UpdateSessionSettingsPayload,
  UpdateTemplatePayload,
} from "@gestarahub/contracts";
import { queryKeys } from "@/lib/queryKeys";
import { communicationService } from "@/services/communicationService";

export function useWhatsAppSession() {
  return useQuery({
    queryKey: queryKeys.communication.session,
    queryFn: () => communicationService.getSession(),
  });
}

export function useConnectWhatsApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => communicationService.connectWhatsApp(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.communication.all });
    },
  });
}

export function useDisconnectWhatsApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => communicationService.disconnectWhatsApp(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.communication.all });
    },
  });
}

export function useUpdateSessionSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSessionSettingsPayload) =>
      communicationService.updateSessionSettings(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.communication.session });
    },
  });
}

export function useMessageTemplates() {
  return useQuery({
    queryKey: queryKeys.communication.templates,
    queryFn: () => communicationService.listTemplates(),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateTemplatePayload) =>
      communicationService.updateTemplate(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.communication.templates });
      qc.invalidateQueries({ queryKey: queryKeys.communication.metrics });
    },
  });
}

export function useMessageLogs(filter?: {
  trigger?: string;
  status?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: queryKeys.communication.logs(filter),
    queryFn: () => communicationService.listLogs(filter),
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SendMessagePayload) =>
      communicationService.sendMessage(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.communication.all });
    },
  });
}

export function useRetryMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => communicationService.retryFailedMessage(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.communication.logs() });
    },
  });
}

export function useCommunicationMetrics() {
  return useQuery({
    queryKey: queryKeys.communication.metrics,
    queryFn: () => communicationService.getMetrics(),
  });
}
