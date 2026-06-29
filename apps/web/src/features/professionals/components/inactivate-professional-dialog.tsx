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
import { getErrorMessage } from "@/lib/api-error";
import type { Professional } from "@/types";
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
    <AlertDialog
      open={professional !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Inativar profissional?</AlertDialogTitle>
          <AlertDialogDescription>
            {professional ? (
              <>
                “{professional.name}” deixará de ser sugerido em novos
                agendamentos. Você pode reativá-lo depois.
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
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {inactivateMut.isPending ? "Inativando..." : "Inativar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
