"use client";

import { useState } from "react";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { plural } from "@gestarahub/core/format";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { whatsappNumber } from "@/lib/whatsapp";
import { useRetainedValue } from "@/lib/use-retained-value";
import { useWhatsAppSend } from "../hooks/use-communication";
import type { ReminderGroup, ReminderItem } from "../reminders";
import { MessageBubble } from "./message-bubble";

/**
 * Envio em sequencia (doc product/25): os pendentes de um grupo, um por vez,
 * com a mensagem pronta. Cada toque abre o WhatsApp do aluno (o navegador nao
 * deixa abrir o proximo sozinho, sem um toque) e ja deixa o proximo na tela.
 * No WhatsApp oficial (Pro), o toque envia. A fila e a da hora em que abriu:
 * o que for avisado no meio nao some da frente da pessoa.
 */
export function ReminderSequenceDialog({
  group: groupProp,
  open,
  onOpenChange,
}: {
  group: ReminderGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const group = useRetainedValue(groupProp);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-lg"
      >
        <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">Enviar em sequência</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">{group?.title ?? ""}</SheetDescription>
        </SheetHeader>
        {group ? (
          // Fila nova a cada abertura (a chave muda com o grupo e o "aberto").
          <SequenceBody key={`${group.key}-${open}`} group={group} onClose={() => onOpenChange(false)} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function SequenceBody({ group, onClose }: { group: ReminderGroup; onClose: () => void }) {
  const whatsapp = useWhatsAppSend();
  const [queue] = useState<ReminderItem[]>(() => group.items.filter((item) => !item.done));
  const [index, setIndex] = useState(0);
  const [sent, setSent] = useState(0);
  const official = whatsapp.mode === "official";
  const current = queue[index];

  if (!current) {
    return (
      <>
        <DialogBody contentClassName="flex flex-col items-center gap-3 space-y-0 py-10 text-center">
          <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400" />
          <p className="text-base font-semibold text-foreground">Pronto</p>
          <p className="text-sm text-muted-foreground">
            {sent > 0
              ? `${plural(sent, official ? "mensagem enviada" : "mensagem aberta no WhatsApp", official ? "mensagens enviadas" : "mensagens abertas no WhatsApp")}.`
              : "Nenhuma mensagem enviada."}
          </p>
        </DialogBody>
        <DialogFooter className="shrink-0 border-t border-border/40 bg-background p-6 pt-4">
          <Button type="button" onClick={onClose}>
            Concluir
          </Button>
        </DialogFooter>
      </>
    );
  }

  const hasPhone = Boolean(whatsappNumber(current.phone ?? ""));
  const text =
    current.content ??
    whatsapp.compose(current.trigger, current.values, current.recipientName ?? current.studentName, current.aboutStudent);
  const next = () => setIndex((i) => i + 1);

  function sendCurrent() {
    whatsapp.send({
      trigger: current.trigger,
      recipient: {
        name: current.recipientName ?? current.studentName,
        phone: current.phone,
        clientId: current.studentId,
        aboutStudent: current.aboutStudent,
      },
      values: current.values,
      ...(current.content ? { content: current.content } : {}),
      ...(current.chargeId ? { chargeId: current.chargeId } : {}),
      // A pessoa ve o texto aqui: no oficial, envia sem perguntar de novo.
      reviewed: true,
    });
    setSent((n) => n + 1);
    next();
  }

  return (
    <>
      <DialogBody className="space-y-4">
        <p className="text-xs font-medium text-muted-foreground" aria-live="polite">
          {index + 1} de {queue.length}
        </p>
        <div className="space-y-0.5">
          <p className="text-base font-semibold text-foreground">{current.studentName}</p>
          <p className="text-sm text-muted-foreground">{current.detail}</p>
        </div>
        {hasPhone ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Como o aluno recebe</p>
            <MessageBubble text={text} />
          </div>
        ) : (
          <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
            Sem WhatsApp com DDD no cadastro. Pule e atualize o telefone depois.
          </p>
        )}
        {queue.length > index + 1 ? (
          <p className="text-xs text-muted-foreground">Próximo: {queue[index + 1].studentName}</p>
        ) : null}
      </DialogBody>
      <DialogFooter className="shrink-0 border-t border-border/40 bg-background p-6 pt-4">
        <Button type="button" variant="outline" onClick={next}>
          Pular
        </Button>
        <Button type="button" onClick={sendCurrent} disabled={!hasPhone || !whatsapp.ready || !text}>
          <MessageCircle className="size-4" />
          {official ? "Enviar" : "Abrir WhatsApp"}
        </Button>
      </DialogFooter>
    </>
  );
}
