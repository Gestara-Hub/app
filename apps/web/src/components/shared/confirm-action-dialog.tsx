"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
  highlightAction?: "confirm" | "cancel";
  isPending?: boolean;
  onConfirm: () => Promise<void> | void;
  /** Conteudo extra entre o texto e os botoes (ex.: campo de motivo). */
  children?: ReactNode;
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "destructive",
  highlightAction = "confirm",
  isPending = false,
  onConfirm,
  children,
}: ConfirmActionDialogProps) {
  // Trava contra duplo clique: o `isPending` da mutacao so desabilita o botao
  // no render seguinte, e o segundo clique chegaria antes (acao em dobro).
  const lockRef = useRef(false);
  useEffect(() => {
    if (open) lockRef.current = false;
  }, [open]);

  const handleConfirm = async (event: React.MouseEvent) => {
    event.preventDefault();
    if (lockRef.current || isPending) return;
    lockRef.current = true;
    try {
      await onConfirm();
    } finally {
      // Ate la o `isPending` ja assumiu; com erro e o dialogo aberto, libera.
      window.setTimeout(() => {
        lockRef.current = false;
      }, 400);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          {highlightAction === "cancel" ? (
            <>
              <AlertDialogAction
                onClick={handleConfirm}
                disabled={isPending}
                variant="outline"
              >
                {isPending ? "Processando..." : confirmLabel}
              </AlertDialogAction>
              <AlertDialogCancel disabled={isPending} variant="default">
                {cancelLabel}
              </AlertDialogCancel>
            </>
          ) : (
            <>
              <AlertDialogCancel disabled={isPending}>{cancelLabel}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirm}
                disabled={isPending}
                variant={variant === "destructive" ? "destructive" : "default"}
              >
                {isPending ? "Processando..." : confirmLabel}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export interface ConfirmActionOptions {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
  highlightAction?: "confirm" | "cancel";
}

/**
 * Confirmacao imperativa para acoes pontuais (reativar, desfazer pagamento...):
 * `if (!(await confirm({...}))) return;`. Renderize `dialog` uma vez no componente.
 */
export function useConfirmAction() {
  // `open` separado das opcoes: ao fechar, as opcoes ficam ate a proxima
  // confirmacao, para titulo, texto e botoes nao mudarem durante a animacao de saida.
  const [pending, setPending] = useState<{
    options: ConfirmActionOptions;
    resolve: (confirmed: boolean) => void;
    open: boolean;
  } | null>(null);

  const confirm = useCallback(
    (options: ConfirmActionOptions) =>
      new Promise<boolean>((resolve) => setPending({ options, resolve, open: true })),
    [],
  );

  const settle = (confirmed: boolean) => {
    if (!pending?.open) return;
    pending.resolve(confirmed);
    setPending({ ...pending, open: false });
  };

  const dialog = (
    <ConfirmActionDialog
      open={pending?.open ?? false}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
      title={pending?.options.title ?? ""}
      description={pending?.options.description ?? null}
      confirmLabel={pending?.options.confirmLabel}
      cancelLabel={pending?.options.cancelLabel ?? "Voltar"}
      variant={pending?.options.variant ?? "default"}
      highlightAction={pending?.options.highlightAction ?? "confirm"}
      onConfirm={() => settle(true)}
    />
  );

  return { confirm, dialog };
}
