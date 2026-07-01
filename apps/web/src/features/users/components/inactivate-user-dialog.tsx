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
import type { UserView } from "@/types";
import { useInactivateUser } from "../hooks/use-users";

interface InactivateUserDialogProps {
  user: UserView | null;
  onOpenChange: (open: boolean) => void;
}

export function InactivateUserDialog({
  user,
  onOpenChange,
}: InactivateUserDialogProps) {
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
    <AlertDialog
      open={user !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Inativar usuário?</AlertDialogTitle>
          <AlertDialogDescription>
            {user ? (
              <>
                “{user.name}” deixará de acessar o sistema. Você pode reativá-lo
                depois.
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
