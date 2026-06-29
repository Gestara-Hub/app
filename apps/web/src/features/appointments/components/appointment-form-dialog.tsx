"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppointmentForm } from "./appointment-form";

interface AppointmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: string;
  defaultProfessionalId?: string;
}

export function AppointmentFormDialog({
  open,
  onOpenChange,
  defaultDate,
  defaultProfessionalId,
}: AppointmentFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>
            Selecione cliente, profissional, serviço, data e horário.
          </DialogDescription>
        </DialogHeader>
        <AppointmentForm
          key={`${defaultDate}-${defaultProfessionalId ?? ""}-${String(open)}`}
          defaultDate={defaultDate}
          defaultProfessionalId={defaultProfessionalId}
          formId="appointment-form"
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
