"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProfessionalView } from "@gestarahub/contracts";
import { useModel } from "@/features/auth";
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
  const isClasses = useModel() === "classes";

  const description = isClasses
    ? isEdit
      ? "Atualize os dados e modalidades do instrutor."
      : "Cadastre um instrutor e as modalidades que leciona."
    : isEdit
      ? "Atualize os dados, serviços e disponibilidade."
      : "Cadastre um profissional, os serviços que realiza e a disponibilidade.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[88vh] sm:max-w-xl flex flex-col p-0 gap-0 overflow-hidden"
        onInteractOutside={(event) => event.preventDefault()}
        expandable
        storageKey="professional"
      >
        <DialogHeader className="p-6 pb-4 border-b border-border/40 shrink-0 pr-20">
          <DialogTitle>
            {isEdit ? "Editar profissional" : "Novo profissional"}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
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
