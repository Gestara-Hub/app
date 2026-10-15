"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { Category } from "@gestarahub/contracts";
import { useModalityVocabulary, useOrganization } from "@/features/settings";
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
  // Editar: palavras da trilha da modalidade; nova: as da area.
  const vocabulary = useModalityVocabulary(modality);
  // Modalidade nova parte do padrao da area (trilha e avaliacoes): espera a
  // organizacao carregar, senao o formulario nasce com o padrao de lutas.
  const { isPending: segmentPending } = useOrganization();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        expandable
        className="max-h-[90vh] sm:max-w-xl flex flex-col p-0 gap-0 overflow-hidden"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="p-6 pb-4 border-b border-border/40 shrink-0 pr-16">
          <DialogTitle>
            {isEdit ? "Editar modalidade" : "Nova modalidade"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Configure o nome, a ${vocabulary.trackTitle.toLowerCase()} e a disponibilidade.`
              : `Configure a modalidade e, se quiser, a ${vocabulary.trackTitle.toLowerCase()}.`}
          </DialogDescription>
        </DialogHeader>
        {!isEdit && segmentPending ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : (
          <ModalityForm
            key={modality?.id ?? "nova"}
            modality={modality}
            formId="modality-form"
            onSuccess={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
