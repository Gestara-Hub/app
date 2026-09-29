"use client";

import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { useRetainedValue } from "@/lib/use-retained-value";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type { Service } from "@gestarahub/contracts";
import { useInactivateService } from "../hooks/use-services";

interface InactivateServiceDialogProps {
  service: Service | null;
  onOpenChange: (open: boolean) => void;
}

export function InactivateServiceDialog({
  service,
  onOpenChange,
}: InactivateServiceDialogProps) {
  // Conteudo com o ultimo registro: nao some durante a animacao de saida.
  const shown = useRetainedValue(service);
  const inactivateMut = useInactivateService();

  async function handleConfirm() {
    if (!service) return;
    try {
      await inactivateMut.mutateAsync(service.id);
      toast.success("Serviço inativado.");
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível inativar o serviço."));
    }
  }

  return (
    <ConfirmActionDialog
      open={service !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
      title="Inativar serviço?"
      description={
        shown ? (
          <>
            “{shown.name}” deixará de ser sugerido em novos agendamentos.
            Você pode reativá-lo depois.
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
