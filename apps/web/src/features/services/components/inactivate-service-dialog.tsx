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
    <AlertDialog
      open={service !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Inativar serviço?</AlertDialogTitle>
          <AlertDialogDescription>
            {service ? (
              <>
                “{service.name}” deixará de ser sugerido em novos agendamentos.
                Você pode reativá-lo depois.
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
