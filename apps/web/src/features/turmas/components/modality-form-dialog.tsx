"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Category } from "@gestarahub/contracts";
import { ModalityForm } from "./modality-form";

interface ModalityFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modality?: Category;
}

export function ModalityFormDialog({
  open,
  onOpenChange,
  modality,
}: ModalityFormDialogProps) {
  const isEdit = Boolean(modality);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] sm:max-w-md flex flex-col p-0 gap-0 overflow-hidden"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="p-6 pb-4 border-b border-border/40 shrink-0 pr-12">
          <DialogTitle>
            {isEdit ? "Editar modalidade" : "Nova modalidade"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Altere o nome ou a disponibilidade no sistema."
              : "Será usada para vincular turmas e professores."}
          </DialogDescription>
        </DialogHeader>
        <ModalityForm
          key={modality?.id ?? "nova"}
          modality={modality}
          formId="modality-form"
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
