"use client";

import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";

export interface DialogFormFooterProps {
  isPending: boolean;
  isEdit?: boolean;
  createLabel?: string;
  editLabel?: string;
  cancelLabel?: string;
  className?: string;
  onCancel?: () => void;
}

export function DialogFormFooter({
  isPending,
  isEdit = false,
  createLabel = "Adicionar",
  editLabel = "Salvar",
  cancelLabel = "Cancelar",
  className,
  onCancel,
}: DialogFormFooterProps) {
  return (
    <DialogFooter className={className}>
      {onCancel ? (
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={onCancel}
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
        {isPending ? "Salvando..." : isEdit ? editLabel : createLabel}
      </Button>
    </DialogFooter>
  );
}
