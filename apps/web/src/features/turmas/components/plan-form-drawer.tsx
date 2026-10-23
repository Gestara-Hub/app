"use client";

import type { Plan } from "@gestarahub/contracts";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PlanForm } from "./plan-form";

export interface PlanFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: Plan;
}

/**
 * Drawer lateral para criação e edição de Planos de Mensalidade.
 * Ocupa 100vh de altura com largura sm:max-w-lg,
 * mantendo o contexto de fundo visível com backdrop escuro.
 */
export function PlanFormDrawer({
  open,
  onOpenChange,
  plan,
}: PlanFormDrawerProps) {
  const isEdit = Boolean(plan);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 gap-0 overflow-hidden shadow-2xl flex flex-col h-full border-l border-border/60"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="p-6 pb-4 border-b border-border/40 shrink-0 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">
            {isEdit ? "Editar plano" : "Novo plano"}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {isEdit
              ? "Altere o nome, a periodicidade ou o valor."
              : "Será usado para cobrar as mensalidades nas turmas."}
          </SheetDescription>
        </SheetHeader>
        <PlanForm
          key={plan?.id ?? (open ? "open" : "closed")}
          plan={plan}
          formId="plan-form-drawer"
          onSuccess={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
