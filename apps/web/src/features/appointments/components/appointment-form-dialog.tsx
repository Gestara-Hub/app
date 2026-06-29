"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AppointmentView } from "@/types";
import { AppointmentForm } from "./appointment-form";

interface AppointmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: string;
  defaultProfessionalId?: string;
  /** Quando presente, edita o agendamento; senao, cria. */
  appointment?: AppointmentView;
}

export function AppointmentFormDialog({
  open,
  onOpenChange,
  defaultDate,
  defaultProfessionalId,
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
          key={`${appointment?.id ?? "new"}-${defaultDate}-${String(open)}`}
          appointment={appointment}
          defaultDate={defaultDate}
          defaultProfessionalId={defaultProfessionalId}
          formId="appointment-form"
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
