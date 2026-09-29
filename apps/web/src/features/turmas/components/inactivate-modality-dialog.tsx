"use client";

import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { useRetainedValue } from "@/lib/use-retained-value";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type { Category } from "@gestarahub/contracts";
import { useInactivateCategory } from "@/features/categories";

interface InactivateModalityDialogProps {
  modality: Category | null;
  onOpenChange: (open: boolean) => void;
}

export function InactivateModalityDialog({
  modality,
  onOpenChange,
}: InactivateModalityDialogProps) {
  // Conteudo com o ultimo registro: nao some durante a animacao de saida.
  const shown = useRetainedValue(modality);
  const inactivateMut = useInactivateCategory();

  async function handleConfirm() {
    if (!modality) return;
    try {
      await inactivateMut.mutateAsync(modality.id);
      toast.success("Modalidade inativada.");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Não foi possível inativar a modalidade."),
      );
    }
  }

  return (
    <ConfirmActionDialog
      open={modality !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
      title="Inativar modalidade?"
      description={
        shown ? (
          <>
            “{shown.name}” deixará de aparecer em novas turmas e no
            cadastro de instrutores. Você pode reativá-la depois.
          </>
        ) : null
      }
      cancelLabel="Voltar"
      confirmLabel="Inativar"
      isPending={inactivateMut.isPending}
      onConfirm={handleConfirm}
    />
  );
}
