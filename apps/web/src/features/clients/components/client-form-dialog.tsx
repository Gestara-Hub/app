"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Client } from "@gestarahub/contracts";
import { useModel } from "@/features/auth";
import { ClientForm } from "./client-form";

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client;
}

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
}: ClientFormDialogProps) {
  const isClasses = useModel() === "classes";
  const isEdit = Boolean(client);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] sm:max-w-xl flex flex-col p-0 gap-0 overflow-hidden"
        onInteractOutside={(event) => event.preventDefault()}
        expandable
        storageKey="client"
      >
        <DialogHeader className="p-6 pb-4 border-b border-border/40 shrink-0 pr-20">
          <DialogTitle>
            {isEdit
              ? isClasses
                ? "Editar aluno"
                : "Editar cliente"
              : isClasses
                ? "Novo aluno"
                : "Novo cliente"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? isClasses
                ? "Atualize os dados do aluno."
                : "Atualize os dados do cliente."
              : isClasses
                ? "Cadastre um novo aluno."
                : "Cadastre um novo cliente."}
          </DialogDescription>
        </DialogHeader>
        <ClientForm
          key={client?.id ?? "novo"}
          client={client}
          formId="client-form"
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
