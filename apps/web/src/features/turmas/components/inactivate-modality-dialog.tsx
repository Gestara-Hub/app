"use client";

import { toast } from "sonner";
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
    <AlertDialog
      open={modality !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Inativar modalidade?</AlertDialogTitle>
          <AlertDialogDescription>
            {modality ? (
              <>
                “{modality.name}” deixará de aparecer em novas turmas e no
                cadastro de instrutores. Você pode reativá-la depois.
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={inactivateMut.isPending}>
            Voltar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
            disabled={inactivateMut.isPending}
            variant="destructive"
          >
            {inactivateMut.isPending ? "Inativando..." : "Inativar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
