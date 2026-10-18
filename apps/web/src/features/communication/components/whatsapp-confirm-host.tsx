"use client";

import { useSyncExternalStore } from "react";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { useRetainedValue } from "@/lib/use-retained-value";

/**
 * Confirmacao do envio pelo WhatsApp oficial: la a mensagem sai sozinha pela
 * API, entao um toque nunca envia direto (no assistido, quem envia e o proprio
 * WhatsApp do aparelho). Um unico dialogo no app, pedido por `useWhatsAppSend`.
 */
interface PendingSend {
  name: string;
  content: string;
  resolve: (ok: boolean) => void;
}

let pending: PendingSend | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Pede a confirmacao; resolve false se fechar ou se outro envio tomar o lugar. */
export function confirmOfficialSend(name: string, content: string): Promise<boolean> {
  pending?.resolve(false);
  return new Promise((resolve) => {
    pending = { name, content, resolve };
    emit();
  });
}

function settle(ok: boolean): void {
  const current = pending;
  pending = null;
  emit();
  current?.resolve(ok);
}

/** Montado uma vez no layout do app. */
export function WhatsAppConfirmHost() {
  const current = useSyncExternalStore(
    subscribe,
    () => pending,
    () => null,
  );
  // Texto do ultimo envio durante a animacao de saida.
  const shown = useRetainedValue(current);

  return (
    <ConfirmActionDialog
      open={current !== null}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
      title={`Enviar para ${shown?.name || "o aluno"}?`}
      description={
        <span className="block max-h-60 overflow-y-auto whitespace-pre-line rounded-lg border bg-muted/30 p-3 text-left text-sm text-foreground">
          {shown?.content}
        </span>
      }
      confirmLabel="Enviar"
      variant="default"
      onConfirm={() => settle(true)}
    />
  );
}
