"use client";

import { useState } from "react";
import { Eraser } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { useResetData } from "../hooks/use-reset-data";

export function ResetDataActions() {
  const reset = useResetData();
  const [open, setOpen] = useState(false);

  async function handleConfirm() {
    try {
      await reset.mutateAsync();
      toast.success("Mocks zerados — apenas os proprietários foram mantidos.");
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível zerar os mocks."));
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Eraser className="size-4" />
            Zerar mocks
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zerar mocks?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove todos os cadastros e redefine o armazenamento local
              (localStorage). Apenas os proprietários da Barbearia e da
              Academia são mantidos para cadastrar tudo do zero. Esta ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reset.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirm();
              }}
              disabled={reset.isPending}
              variant="destructive"
            >
              {reset.isPending ? "Zerando..." : "Zerar mocks"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
