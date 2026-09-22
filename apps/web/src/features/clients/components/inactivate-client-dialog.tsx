"use client";

import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type { Client } from "@gestarahub/contracts";
import { useModel } from "@/features/auth";
import { useInactivateClient } from "../hooks/use-clients";

interface InactivateClientDialogProps {
  client: Client | null;
  onOpenChange: (open: boolean) => void;
}

export function InactivateClientDialog({
  client,
  onOpenChange,
}: InactivateClientDialogProps) {
  const isClasses = useModel() === "classes";
  const inactivateMut = useInactivateClient();

  async function handleConfirm() {
    if (!client) return;
    try {
      await inactivateMut.mutateAsync(client.id);
      toast.success(isClasses ? "Aluno inativado." : "Cliente inativado.");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          isClasses
            ? "Não foi possível inativar o aluno."
            : "Não foi possível inativar o cliente.",
        ),
      );
    }
  }

  return (
    <ConfirmActionDialog
      open={client !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
      title={isClasses ? "Inativar aluno?" : "Inativar cliente?"}
      description={
        client ? (
          <>
            “{client.name}” deixará de ser sugerido em{" "}
            {isClasses ? "novas matrículas" : "novos agendamentos"}. O histórico
            é mantido e você pode reativá-lo depois.
            {isClasses && client.planId ? (
              <>
                {" "}
                Mensalidades em aberto de períodos que ainda não começaram serão
                canceladas; as já vencidas continuam a receber.
              </>
            ) : null}
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
