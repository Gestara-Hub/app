"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bot, Bug, CheckCircle2, Copy, Lightbulb, LifeBuoy, Loader2, MessageSquarePlus, Send, ThumbsUp } from "lucide-react";
import { format, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/lib/toast";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { formatProtocol } from "@gestarahub/core/support-protocol";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SupportKind, SupportMessage, SupportThreadSummary } from "@/services/support/supportTypes";
import {
  useEscalateSupportThread,
  useMarkBotHelped,
  useSendSupportMessage,
  useSupportThread,
  useSupportThreads,
} from "../hooks/use-support";
import { KIND_COPY, KIND_LABEL, REPLY_PROMISE, STATUS_LABEL, authorLabel, statusNote } from "../support-copy";

type View = { kind: "list" } | { kind: "new"; supportKind: SupportKind } | { kind: "chat"; threadId: string };

const MAX_MESSAGE = 2000;

function when(iso: string): string {
  const date = parseISO(iso);
  return isToday(date) ? format(date, "HH:mm") : format(date, "dd/MM HH:mm", { locale: ptBR });
}

/**
 * "Fale com a gente": o assistente de ajuda e, quando preciso, o suporte do
 * GestaraHub, na mesma conversa (doc technical/26, fase 1). A resposta do
 * suporte aparece aqui e chega por e-mail.
 */
export function SupportSheet({
  open,
  onOpenChange,
  origin,
  draft,
  kind,
  errorReference,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  origin: string;
  draft?: string;
  kind?: SupportKind;
  errorReference?: string;
}) {
  const threads = useSupportThreads(open);
  // A escolha da pessoa; sem escolha, abre numa conversa nova quando veio com texto
  // (ex.: duvida sobre planos) ou nao ha conversas, e na lista nos outros casos.
  const [chosen, setChosen] = useState<View | null>(null);
  const noThreads = threads.isSuccess && threads.data.length === 0;
  const view: View = chosen ?? (kind || draft || noThreads ? { kind: "new", supportKind: kind ?? "question" } : { kind: "list" });
  const setView = setChosen;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setChosen(null);
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b border-border/40 p-5 pb-4 pr-14 text-left">
          <SheetTitle className="flex items-center gap-2 text-lg font-semibold">
            <LifeBuoy className="size-5 text-primary" /> Fale com a gente
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            O assistente responde na hora. Se precisar, enviamos para o suporte.
          </SheetDescription>
        </SheetHeader>
        {view.kind === "list" ? (
          <ThreadList
            threads={threads.data ?? []}
            loading={threads.isPending}
            error={threads.isError}
            onNew={(supportKind) => setView({ kind: "new", supportKind })}
            onOpen={(threadId) => setView({ kind: "chat", threadId })}
          />
        ) : (
          <Chat
            key={view.kind === "chat" ? view.threadId : "new"}
            threadId={view.kind === "chat" ? view.threadId : null}
            open={open}
            origin={origin}
            supportKind={view.kind === "new" ? view.supportKind : "question"}
            draft={view.kind === "new" ? draft : undefined}
            errorReference={errorReference}
            onBack={() => setView({ kind: "list" })}
            onCreated={(threadId) => setView({ kind: "chat", threadId })}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ThreadList({
  threads,
  loading,
  error,
  onNew,
  onOpen,
}: {
  threads: SupportThreadSummary[];
  loading: boolean;
  error: boolean;
  onNew: (kind: SupportKind) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2 border-b border-border/40 p-4">
        <Button className="w-full" onClick={() => onNew("question")}>
          <MessageSquarePlus className="size-4" /> Nova conversa
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => onNew("bug")}>
            <Bug className="size-4" /> Relatar problema
          </Button>
          <Button variant="outline" onClick={() => onNew("suggestion")}>
            <Lightbulb className="size-4" /> Sugerir melhoria
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : error ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            O Fale com a gente funciona só na conta real do seu espaço.
          </p>
        ) : threads.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {threads.map((thread) => (
              <li key={thread.id}>
                <button type="button" onClick={() => onOpen(thread.id)} className="w-full cursor-pointer px-5 py-3.5 text-left hover:bg-muted/40">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 break-words text-sm font-medium">{thread.subject}</p>
                    {thread.unread > 0 ? (
                      <Badge className="shrink-0">{thread.unread} nova{thread.unread > 1 ? "s" : ""}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 line-clamp-1 break-words text-xs text-muted-foreground">{thread.lastPreview}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Protocolo {formatProtocol(thread.number)} · {thread.kind === "question" ? "" : `${KIND_LABEL[thread.kind]} · `}
                    {STATUS_LABEL[thread.status]} · {when(thread.lastMessageAt)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Bubble({ message }: { message: SupportMessage }) {
  if (message.author === "system") {
    return <p className="mx-auto max-w-[90%] rounded-md bg-muted px-3 py-2 text-center text-xs text-muted-foreground">{message.body}</p>;
  }
  const mine = message.author === "customer";
  return (
    <div className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {message.author === "bot" ? <Bot className="size-3" /> : null}
        {authorLabel(message.author, message.staffName)} · {when(message.createdAt)}
      </span>
      <div
        className={cn(
          "max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm",
          mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted",
        )}
      >
        {message.body}
      </div>
      {message.sources && message.sources.length > 0 ? (
        <p className="max-w-[88%] text-[11px] text-muted-foreground">
          Veja também:{" "}
          {message.sources.map((source, i) => (
            <span key={source.article}>
              {i > 0 ? " · " : ""}
              {source.href ? (
                <Link href={source.href} className="underline underline-offset-2 hover:text-foreground">
                  {source.article}
                </Link>
              ) : (
                source.article
              )}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

function Chat({
  threadId,
  open,
  origin,
  supportKind,
  draft,
  errorReference,
  onBack,
  onCreated,
}: {
  threadId: string | null;
  open: boolean;
  origin: string;
  supportKind: SupportKind;
  draft?: string;
  errorReference?: string;
  onBack: () => void;
  onCreated: (threadId: string) => void;
}) {
  const thread = useSupportThread(threadId, open);
  const send = useSendSupportMessage();
  const escalate = useEscalateSupportThread();
  const helped = useMarkBotHelped();
  const [text, setText] = useState(draft ?? "");
  const bottomRef = useRef<HTMLDivElement>(null);
  const view = thread.data;
  const messages = view?.messages ?? [];
  const pending = send.isPending || escalate.isPending || helped.isPending;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  const lastIsBot = messages.at(-1)?.author === "bot";
  const botOpen = view?.status === "bot";
  const note = view ? statusNote(view.status) : null;

  function submit() {
    const message = text.trim();
    if (!message || pending) return;
    send.mutate(
      { threadId: threadId ?? undefined, message, origin, errorReference, kind: threadId ? undefined : supportKind },
      {
        onSuccess: (result) => {
          setText("");
          if (!threadId) onCreated(result.threadId);
        },
        onError: (error) => toast.error(getErrorMessage(error, "Não foi possível enviar. Tente de novo.")),
      },
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/40 px-3 py-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar para as conversas">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium">
            {view?.subject ?? (supportKind === "bug" ? "Relatar problema" : supportKind === "suggestion" ? "Sugerir melhoria" : "Nova conversa")}
          </p>
          {view ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              Protocolo {formatProtocol(view.number)}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Copiar protocolo"
                onClick={() => {
                  navigator.clipboard?.writeText(formatProtocol(view.number)).then(
                    () => toast.success("Protocolo copiado."),
                    () => toast.error("Não foi possível copiar."),
                  );
                }}
              >
                <Copy className="size-3.5" />
              </Button>
            </p>
          ) : null}
        </div>
        {view ? (
          <Badge variant="secondary" className="shrink-0 font-normal">
            {STATUS_LABEL[view.status]}
          </Badge>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {!threadId ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {KIND_COPY[supportKind].intro}
            {errorReference ? ` O código do erro (${errorReference}) vai junto, e a equipe vê o que aconteceu.` : ""}
          </p>
        ) : thread.isPending ? (
          <p className="text-center text-sm text-muted-foreground">Carregando...</p>
        ) : null}
        {messages.map((message) => (
          <Bubble key={message.id} message={message} />
        ))}
        {pending && botOpen !== false ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> {escalate.isPending ? "Enviando ao suporte..." : "Respondendo..."}
          </p>
        ) : null}
        {note ? <p className="rounded-md bg-muted px-3 py-2 text-center text-xs text-muted-foreground">{note}</p> : null}
        <div ref={bottomRef} />
      </div>

      {view && botOpen && lastIsBot && !pending ? (
        <div className="flex shrink-0 flex-wrap gap-2 border-t border-border/40 px-4 py-3">
          {view.needsHuman ? null : (
            <Button
              variant="outline"
              onClick={() => helped.mutate({ threadId: view.threadId, helped: true }, { onError: (e) => toast.error(getErrorMessage(e, "Não foi possível concluir.")) })}
            >
              <ThumbsUp className="size-4" /> Resolveu
            </Button>
          )}
          <Button
            variant={view.needsHuman ? "default" : "outline"}
            onClick={() =>
              escalate.mutate(view.threadId, {
                onSuccess: () => toast.success("Enviado ao suporte. Respondemos em até 2 dias úteis."),
                onError: (e) => toast.error(getErrorMessage(e, "Não foi possível enviar ao suporte.")),
              })
            }
          >
            <LifeBuoy className="size-4" /> Falar com o suporte
          </Button>
        </div>
      ) : null}
      {view?.status === "resolved" && view.botHelped ? (
        <p className="flex shrink-0 items-center justify-center gap-1.5 border-t border-border/40 px-4 py-2 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-success" /> Que bom que ajudou. {REPLY_PROMISE.replace("Respondemos", "Se precisar, respondemos")}
        </p>
      ) : null}

      <form
        className="flex shrink-0 items-end gap-2 border-t border-border/40 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, MAX_MESSAGE))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={view ? "Escreva sua mensagem" : KIND_COPY[supportKind].placeholder}
          aria-label="Mensagem"
          rows={2}
          className="min-h-0 flex-1 resize-none text-base md:text-sm"
        />
        <Button type="submit" size="icon" disabled={!text.trim() || pending} aria-label="Enviar">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
