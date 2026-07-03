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
        className="sm:max-w-lg"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
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
