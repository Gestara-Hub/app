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
        className="sm:max-w-lg"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar modalidade" : "Nova modalidade"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize a modalidade."
              : "Cadastre uma nova modalidade."}
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
