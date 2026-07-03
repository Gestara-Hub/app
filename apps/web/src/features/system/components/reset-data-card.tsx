"use client";

import { useState } from "react";
import { Eraser, RotateCcw } from "lucide-react";
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
import { useClearData, useResetData } from "../hooks/use-reset-data";

export function ResetDataActions() {
  const reset = useResetData();
  const clear = useClearData();
  const [open, setOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  async function handleConfirm() {
    try {
      await reset.mutateAsync();
      toast.success("Dados de exemplo restaurados.");
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível restaurar os dados."));
    }
  }

  async function handleClear() {
    try {
      await clear.mutateAsync();
      toast.success("Mock zerado — só o Proprietário foi mantido. Cadastre tudo do zero.");
      setClearOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível zerar o mock."));
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
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

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="text-destructive hover:text-destructive">
            <Eraser className="size-4" />
            Zerar mock
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zerar o mock?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove todos os clientes, equipe, cargos, serviços, categorias,
              agendamentos, bloqueios e os demais usuários. A organização, a
              unidade e o usuário Proprietário são mantidos, para simular uma
              configuração inicial do zero. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clear.isPending}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleClear();
              }}
              disabled={clear.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {clear.isPending ? "Zerando..." : "Zerar mock"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
