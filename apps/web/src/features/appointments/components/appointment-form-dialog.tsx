"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AppointmentView } from "@gestarahub/contracts";
import { AppointmentForm } from "./appointment-form";

export interface AppointmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProfessionalId?: string;
  defaultDate?: string;
  defaultStart?: string;
  /** Quando presente, edita o agendamento; senao, cria. */
  appointment?: AppointmentView;
}

/**
 * Drawer lateral para criação e edição de Agendamento.
 * Ocupa 100vh de altura com largura ampla (sm:max-w-xl md:max-w-2xl),
 * mantendo o contexto de fundo visível com backdrop escuro.
 */
export function AppointmentFormDialog({
  open,
  onOpenChange,
  defaultProfessionalId,
  defaultDate,
  defaultStart,
  appointment,
}: AppointmentFormDialogProps) {
  const isEdit = Boolean(appointment);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl p-0 gap-0 overflow-hidden shadow-2xl flex flex-col h-full border-l border-border/60"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="p-6 pb-4 border-b border-border/40 shrink-0 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">
            {isEdit ? "Editar agendamento" : "Novo agendamento"}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Selecione cliente, profissional, serviço, data e horário.
          </SheetDescription>
        </SheetHeader>
        <AppointmentForm
          key={`${appointment?.id ?? "new"}-${defaultProfessionalId ?? ""}-${defaultDate ?? ""}-${defaultStart ?? ""}-${String(open)}`}
          appointment={appointment}
          defaultProfessionalId={defaultProfessionalId}
          defaultDate={defaultDate}
          defaultStart={defaultStart}
          formId="appointment-form-drawer"
          onSuccess={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

export const AppointmentFormDrawer = AppointmentFormDialog;
