"use client";

import { useTeamWords } from "@/features/settings";
import { toast } from "@/lib/toast";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { useRetainedValue } from "@/lib/use-retained-value";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type { Professional } from "@gestarahub/contracts";
import { useModel } from "@/features/auth";
import { useInactivateProfessional } from "../hooks/use-professionals";

interface InactivateProfessionalDialogProps {
  professional: Professional | null;
  onOpenChange: (open: boolean) => void;
}

export function InactivateProfessionalDialog({
  professional,
  onOpenChange,
}: InactivateProfessionalDialogProps) {
  const team = useTeamWords();
  // Conteudo com o ultimo registro: nao some durante a animacao de saida.
  const shown = useRetainedValue(professional);
  const inactivateMut = useInactivateProfessional();
  const isClasses = useModel() === "classes";

  async function handleConfirm() {
    if (!professional) return;
    try {
      await inactivateMut.mutateAsync(professional.id);
      toast.success(`${team.title} inativado.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        getErrorMessage(error, `Não foi possível inativar o ${team.lower}.`),
      );
    }
  }

  return (
    <ConfirmActionDialog
      open={professional !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
      title={`Inativar ${team.lower}?`}
      description={
        shown ? (
          <>
            “{shown.name}” deixará de ser sugerido{" "}
            {isClasses
              ? `como ${team.lower} em novas turmas e substituições. As turmas atuais mantêm o ${team.lower}`
              : "em novos agendamentos"}
            . Você pode reativá-lo depois.
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
