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
import type { Client } from "@gestarahub/contracts";
import { useInactivateClient } from "../hooks/use-clients";

interface InactivateClientDialogProps {
  client: Client | null;
  onOpenChange: (open: boolean) => void;
}

export function InactivateClientDialog({
  client,
  onOpenChange,
}: InactivateClientDialogProps) {
  const inactivateMut = useInactivateClient();

  async function handleConfirm() {
    if (!client) return;
    try {
      await inactivateMut.mutateAsync(client.id);
      toast.success("Cliente inativado.");
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível inativar o cliente."));
    }
  }

  return (
    <AlertDialog
      open={client !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Inativar cliente?</AlertDialogTitle>
          <AlertDialogDescription>
            {client ? (
              <>
                “{client.name}” deixará de ser sugerido em novos agendamentos.
                O histórico é mantido e você pode reativá-lo depois.
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
