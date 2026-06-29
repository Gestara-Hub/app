"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoleForm } from "./role-form";
import { RolesList } from "./roles-list";

interface RoleManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Gestao de cargos: formulario de criacao no topo e a listagem padrao abaixo.
 * A edicao acontece inline na propria linha (input + salvar/cancelar).
 */
export function RoleManagerDialog({ open, onOpenChange }: RoleManagerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[85vh] flex-col gap-4 sm:max-w-lg"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Cargos</DialogTitle>
          <DialogDescription>
            Cadastre e gerencie os cargos da equipe.
          </DialogDescription>
        </DialogHeader>

        <RoleForm />

        <div className="min-h-0 flex-1 overflow-y-auto border-t pt-4">
          <RolesList />
        </div>
      </DialogContent>
    </Dialog>
  );
}
