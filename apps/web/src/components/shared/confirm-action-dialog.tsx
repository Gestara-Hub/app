"use client";

import { useCallback, useState, type ReactNode } from "react";
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
}: ConfirmActionDialogProps) {
  const handleConfirm = async (event: React.MouseEvent) => {
    event.preventDefault();
    await onConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
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
  const [pending, setPending] = useState<{
    options: ConfirmActionOptions;
    resolve: (confirmed: boolean) => void;
  } | null>(null);

  const confirm = useCallback(
    (options: ConfirmActionOptions) =>
      new Promise<boolean>((resolve) => setPending({ options, resolve })),
    [],
  );

  const settle = (confirmed: boolean) => {
    pending?.resolve(confirmed);
    setPending(null);
  };

  const dialog = (
    <ConfirmActionDialog
      open={pending !== null}
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
