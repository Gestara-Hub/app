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
}

export function DialogFormFooter({
  isPending,
  isEdit = false,
  createLabel = "Criar",
  editLabel = "Salvar alterações",
  cancelLabel = "Cancelar",
  className,
}: DialogFormFooterProps) {
  return (
    <DialogFooter className={className}>
      <DialogClose asChild>
        <Button type="button" variant="outline" disabled={isPending}>
          {cancelLabel}
        </Button>
      </DialogClose>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando..." : isEdit ? editLabel : createLabel}
      </Button>
    </DialogFooter>
  );
}
