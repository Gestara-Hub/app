"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AppointmentView } from "@gestarahub/contracts";
import { AppointmentForm } from "./appointment-form";

interface AppointmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProfessionalId?: string;
  defaultDate?: string;
  defaultStart?: string;
  /** Quando presente, edita o agendamento; senao, cria. */
  appointment?: AppointmentView;
}

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar agendamento" : "Novo agendamento"}
          </DialogTitle>
          <DialogDescription>
            Selecione cliente, profissional, serviço, data e horário.
          </DialogDescription>
        </DialogHeader>
        <AppointmentForm
          key={`${appointment?.id ?? "new"}-${defaultProfessionalId ?? ""}-${defaultDate ?? ""}-${defaultStart ?? ""}-${String(open)}`}
          appointment={appointment}
          defaultProfessionalId={defaultProfessionalId}
          defaultDate={defaultDate}
          defaultStart={defaultStart}
          formId="appointment-form"
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
