"use client";

import type { Service } from "@gestarahub/contracts";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ServiceForm } from "./service-form";

export interface ServiceFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: Service;
}

/**
 * Drawer lateral para criação e edição de Serviço no catálogo.
 * Ocupa 100vh de altura com largura sm:max-w-lg,
 * mantendo o contexto de fundo visível com backdrop escuro.
 */
export function ServiceFormDrawer({
  open,
  onOpenChange,
  service,
}: ServiceFormDrawerProps) {
  const isEdit = Boolean(service);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 gap-0 overflow-hidden shadow-2xl flex flex-col h-full border-l border-border/60"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="p-6 pb-4 border-b border-border/40 shrink-0 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">
            {isEdit ? "Editar serviço" : "Novo serviço"}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {isEdit
              ? "Atualize os dados do serviço."
              : "Cadastre um novo serviço no catálogo."}
          </SheetDescription>
        </SheetHeader>
        <ServiceForm
          key={service?.id ?? (open ? "open" : "closed")}
          service={service}
          formId="service-form-drawer"
          onSuccess={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
