"use client";

import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter, useDialogDirty } from "@/components/ui/dialog";

export interface DialogFormFooterProps {
  isPending: boolean;
  isEdit?: boolean;
  createLabel?: string;
  /** Texto do botao enquanto salva (padrao "Salvando..."). */
  pendingLabel?: string;
  editLabel?: string;
  cancelLabel?: string;
  className?: string;
  onCancel?: () => void;
}

export function DialogFormFooter({
  isPending,
  isEdit = false,
  createLabel = "Adicionar",
  pendingLabel = "Salvando...",
  editLabel = "Salvar",
  cancelLabel = "Cancelar",
  className,
  onCancel,
}: DialogFormFooterProps) {
  // Cancelar com alteracao pede confirmacao, como o X e o Esc.
  const guard = useDialogDirty();
  return (
    <DialogFooter className={className} saving={isPending}>
      {onCancel ? (
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => (guard ? guard.guardClose(onCancel) : onCancel())}
        >
          {cancelLabel}
        </Button>
      ) : (
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={isPending}>
            {cancelLabel}
          </Button>
        </DialogClose>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? pendingLabel : isEdit ? editLabel : createLabel}
      </Button>
    </DialogFooter>
  );
}
