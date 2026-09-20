"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UserView } from "@gestarahub/contracts";
import { UserForm } from "./user-form";

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserView;
}

export function UserFormDialog({ open, onOpenChange, user }: UserFormDialogProps) {
  const isEdit = Boolean(user);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] sm:max-w-lg flex flex-col p-0 gap-0 overflow-hidden"
        onInteractOutside={(event) => event.preventDefault()}
        expandable
        storageKey="user"
      >
        <DialogHeader className="p-6 pb-4 border-b border-border/40 shrink-0 pr-20">
          <DialogTitle>{isEdit ? "Editar usuário" : "Novo usuário"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize os dados e o perfil de acesso."
              : "Cadastre quem pode acessar o sistema e o perfil de acesso."}
          </DialogDescription>
        </DialogHeader>
        <UserForm
          key={user?.id ?? "novo"}
          user={user}
          formId="user-form"
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
