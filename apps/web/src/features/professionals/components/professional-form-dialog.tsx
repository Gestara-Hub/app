"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProfessionalView } from "@/types";
import { ProfessionalForm } from "./professional-form";

interface ProfessionalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professional?: ProfessionalView;
}

export function ProfessionalFormDialog({
  open,
  onOpenChange,
  professional,
}: ProfessionalFormDialogProps) {
  const isEdit = Boolean(professional);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[88vh] overflow-y-auto sm:max-w-xl"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar profissional" : "Novo profissional"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize os dados, serviços e disponibilidade."
              : "Cadastre um profissional, os serviços que realiza e a disponibilidade."}
          </DialogDescription>
        </DialogHeader>
        <ProfessionalForm
          key={professional?.id ?? "novo"}
          professional={professional}
          formId="professional-form"
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
