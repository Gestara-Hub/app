"use client";

import type { Client } from "@gestarahub/contracts";
import { useModel } from "@/features/auth";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ClientForm, type ClientFormFocus } from "./client-form";

interface ClientFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client;
  /** Abre ja com foco aqui ("Trocar plano" ou "Completar cadastro" da ficha). */
  initialFocus?: ClientFormFocus;
}

/**
 * Drawer lateral para criação e edição de Aluno/Cliente.
 * Ocupa 100vh de altura e largura ampla (max-w-2xl a max-w-3xl),
 * mantendo o contexto de fundo visível com backdrop escuro.
 */
export function ClientFormDrawer({
  open,
  onOpenChange,
  client,
  initialFocus,
}: ClientFormDrawerProps) {
  const isClasses = useModel() === "classes";
  const isEdit = Boolean(client);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0 gap-0 overflow-hidden shadow-2xl flex flex-col h-full border-l border-border/60"
        onInteractOutside={(event) => event.preventDefault()}
        // Com um alvo pedido, o foco vai para ele (o formulario cuida), nao para o nome.
        onOpenAutoFocus={initialFocus ? (event) => event.preventDefault() : undefined}
      >
        <SheetHeader className="p-6 pb-4 border-b border-border/40 shrink-0 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">
            {isEdit
              ? isClasses
                ? "Editar aluno"
                : "Editar cliente"
              : isClasses
                ? "Novo aluno"
                : "Novo cliente"}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {isEdit
              ? isClasses
                ? "Atualize os dados do aluno."
                : "Atualize os dados do cliente."
              : isClasses
                ? "Cadastre um novo aluno com plano e responsáveis."
                : "Cadastre um novo cliente."}
          </SheetDescription>
        </SheetHeader>
        <ClientForm
          key={`${client?.id ?? (open ? "open" : "closed")}-${initialFocus ?? ""}`}
          client={client}
          initialFocus={initialFocus}
          formId="client-form-drawer"
          onSuccess={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
