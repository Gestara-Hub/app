"use client";

import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type { Professional } from "@gestarahub/contracts";
import { useInactivateProfessional } from "../hooks/use-professionals";

interface InactivateProfessionalDialogProps {
  professional: Professional | null;
  onOpenChange: (open: boolean) => void;
}

export function InactivateProfessionalDialog({
  professional,
  onOpenChange,
}: InactivateProfessionalDialogProps) {
  const inactivateMut = useInactivateProfessional();

  async function handleConfirm() {
    if (!professional) return;
    try {
      await inactivateMut.mutateAsync(professional.id);
      toast.success("Profissional inativado.");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Não foi possível inativar o profissional."),
      );
    }
  }

  return (
    <ConfirmActionDialog
      open={professional !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
      title="Inativar profissional?"
      description={
        professional ? (
          <>
            “{professional.name}” deixará de ser sugerido em novos
            agendamentos. Você pode reativá-lo depois.
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
