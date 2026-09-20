"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Service } from "@gestarahub/contracts";
import { ServiceForm } from "./service-form";

interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: Service;
}

export function ServiceFormDialog({
  open,
  onOpenChange,
  service,
}: ServiceFormDialogProps) {
  const isEdit = Boolean(service);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] sm:max-w-lg flex flex-col p-0 gap-0 overflow-hidden"
        onInteractOutside={(event) => event.preventDefault()}
        expandable
        storageKey="service"
      >
        <DialogHeader className="p-6 pb-4 border-b border-border/40 shrink-0 pr-20">
          <DialogTitle>{isEdit ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize os dados do serviço."
              : "Cadastre um novo serviço no catálogo."}
          </DialogDescription>
        </DialogHeader>
        {/* key reinicia o form ao alternar entre criar/editar/outro servico. */}
        <ServiceForm
          key={service?.id ?? "novo"}
          service={service}
          formId="service-form"
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
