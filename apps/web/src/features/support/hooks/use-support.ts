"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { unwrap } from "@/services/server/action";
import {
  escalateSupportThreadAction,
  getSupportThreadAction,
  listSupportThreadsAction,
  markSupportBotHelpedAction,
  sendSupportMessageAction,
  supportUnreadCountAction,
} from "@/services/support/supportActions";
import type { SupportKind, SupportThreadView } from "@/services/support/supportTypes";

const keys = {
  all: ["support"] as const,
  list: ["support", "list"] as const,
  unread: ["support", "unread"] as const,
  thread: (id: string) => ["support", "thread", id] as const,
};

/** Nao lidos do suporte (bolinha no menu). Consulta a cada minuto; erro (demonstracao) some em silencio. */
export function useSupportUnread(enabled = true) {
  return useQuery({
    queryKey: keys.unread,
    queryFn: () => unwrap(supportUnreadCountAction()),
    enabled,
    refetchInterval: 60_000,
    retry: false,
    staleTime: 30_000,
  });
}

export function useSupportThreads(enabled: boolean) {
  return useQuery({
    queryKey: keys.list,
    queryFn: () => unwrap(listSupportThreadsAction()),
    enabled,
    retry: false,
  });
}

/** A conversa aberta; enquanto a janela esta aberta, confere novas respostas a cada 15 s. */
export function useSupportThread(threadId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: keys.thread(threadId ?? "none"),
    queryFn: () => unwrap(getSupportThreadAction(threadId as string)),
    enabled: enabled && Boolean(threadId),
    refetchInterval: 15_000,
    retry: false,
  });
}

function useSyncThread() {
  const queryClient = useQueryClient();
  return (view: SupportThreadView) => {
    queryClient.setQueryData(keys.thread(view.threadId), view);
    void queryClient.invalidateQueries({ queryKey: keys.list });
    void queryClient.invalidateQueries({ queryKey: keys.unread });
  };
}

export function useSendSupportMessage() {
  const sync = useSyncThread();
  return useMutation({
    mutationFn: (input: { threadId?: string; message: string; origin?: string; errorReference?: string; kind?: SupportKind }) =>
      unwrap(sendSupportMessageAction(input)),
    onSuccess: sync,
  });
}

export function useEscalateSupportThread() {
  const sync = useSyncThread();
  return useMutation({ mutationFn: (threadId: string) => unwrap(escalateSupportThreadAction(threadId)), onSuccess: sync });
}

export function useMarkBotHelped() {
  const sync = useSyncThread();
  return useMutation({
    mutationFn: (input: { threadId: string; helped: boolean }) => unwrap(markSupportBotHelpedAction(input.threadId, input.helped)),
    onSuccess: sync,
  });
}
