"use client";

import type { UserView } from "@gestarahub/contracts";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UserForm } from "./user-form";

export interface UserFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserView;
}

/**
 * Drawer lateral para criação e edição de Usuário / Convite de Acesso.
 * Ocupa 100vh de altura com largura sm:max-w-lg,
 * mantendo o contexto de fundo visível com backdrop escuro.
 */
export function UserFormDrawer({ open, onOpenChange, user }: UserFormDrawerProps) {
  const isEdit = Boolean(user);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 gap-0 overflow-hidden shadow-2xl flex flex-col h-full border-l border-border/60"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="p-6 pb-4 border-b border-border/40 shrink-0 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">
            {isEdit ? "Editar usuário" : "Novo usuário"}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {isEdit
              ? "Atualize os dados e o perfil de acesso."
              : "Cadastre quem pode acessar o sistema e o perfil de acesso."}
          </SheetDescription>
        </SheetHeader>
        <UserForm
          key={user?.id ?? (open ? "open" : "closed")}
          user={user}
          formId="user-form-drawer"
          onSuccess={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
