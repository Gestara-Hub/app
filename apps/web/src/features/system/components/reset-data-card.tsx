"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getErrorMessage } from "@/lib/api-error";
import { useResetData } from "../hooks/use-reset-data";

export function ResetDataCard() {
  const reset = useResetData();
  const [open, setOpen] = useState(false);

  async function handleConfirm() {
    try {
      await reset.mutateAsync();
      toast.success("Dados de exemplo restaurados.");
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível restaurar os dados."));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados de exemplo</CardTitle>
        <CardDescription>
          Suas alterações ficam salvas no navegador (localStorage). Restaurar
          descarta tudo e recarrega o catálogo de exemplo da Corte Nobre.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="outline">
              <RotateCcw className="size-4" />
              Restaurar dados de exemplo
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restaurar dados de exemplo?</AlertDialogTitle>
              <AlertDialogDescription>
                Todas as alterações feitas serão descartadas e o catálogo de
                exemplo será recarregado. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={reset.isPending}>
                Voltar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void handleConfirm();
                }}
                disabled={reset.isPending}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {reset.isPending ? "Restaurando..." : "Restaurar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
