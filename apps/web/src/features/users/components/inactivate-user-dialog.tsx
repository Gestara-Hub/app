"use client";

import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { useRetainedValue } from "@/lib/use-retained-value";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type { UserView } from "@gestarahub/contracts";
import { useInactivateUser } from "../hooks/use-users";

interface InactivateUserDialogProps {
  user: UserView | null;
  onOpenChange: (open: boolean) => void;
}

export function InactivateUserDialog({
  user,
  onOpenChange,
}: InactivateUserDialogProps) {
  // Conteudo com o ultimo registro: nao some durante a animacao de saida.
  const shown = useRetainedValue(user);
  const inactivateMut = useInactivateUser();

  async function handleConfirm() {
    if (!user) return;
    try {
      await inactivateMut.mutateAsync(user.id);
      toast.success("Usuário inativado.");
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível inativar o usuário."));
    }
  }

  return (
    <ConfirmActionDialog
      open={user !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
      title="Inativar usuário?"
      description={
        shown ? (
          <>
            “{shown.name}” deixará de acessar o sistema. Você pode reativá-lo
            depois.
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
