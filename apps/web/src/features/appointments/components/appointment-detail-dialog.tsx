"use client";

import { useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, CheckCheck, Play, Repeat, UserX } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/api-error";
import { formatCents } from "@/lib/format";
import type { AppointmentStatus, AppointmentView } from "@/types";
import { useSetAppointmentStatus } from "../hooks/use-appointments";
import { AppointmentStatusBadge } from "./appointment-status-badge";

const STATUS_TOAST: Record<AppointmentStatus, string> = {
  pending: "Agendamento atualizado.",
  confirmed: "Agendamento confirmado.",
  in_service: "Atendimento iniciado.",
  completed: "Atendimento concluído.",
  canceled: "Agendamento cancelado. O registro permanece no histórico.",
  no_show: "Marcado como não compareceu.",
};

// Avanco principal de status conforme o estado atual.
const ADVANCE: Partial<
  Record<AppointmentStatus, { status: AppointmentStatus; label: string; icon: ReactNode }>
> = {
  pending: { status: "confirmed", label: "Confirmar", icon: <Check className="size-4" /> },
  confirmed: { status: "in_service", label: "Iniciar atendimento", icon: <Play className="size-4" /> },
  in_service: { status: "completed", label: "Concluir", icon: <CheckCheck className="size-4" /> },
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

interface AppointmentDetailDialogProps {
  appointment: AppointmentView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AppointmentDetailDialog({
  appointment,
  open,
  onOpenChange,
}: AppointmentDetailDialogProps) {
  const setStatusMut = useSetAppointmentStatus();
  const [showCancel, setShowCancel] = useState(false);
  const pending = setStatusMut.isPending;

  if (!appointment) return null;

  const rawDate = format(parseISO(appointment.date), "EEEE, d 'de' MMMM", { locale: ptBR });
  const dateLabel = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
  const isTerminal =
    appointment.status === "completed" ||
    appointment.status === "canceled" ||
    appointment.status === "no_show";
  const advance = ADVANCE[appointment.status];
  const canNoShow = appointment.status === "pending" || appointment.status === "confirmed";

  async function changeStatus(status: AppointmentStatus) {
    try {
      await setStatusMut.mutateAsync({ id: appointment!.id, status });
      toast.success(STATUS_TOAST[status]);
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível atualizar o status."));
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {appointment.client.name}
              <AppointmentStatusBadge status={appointment.status} />
            </DialogTitle>
          </DialogHeader>

          <div className="divide-y">
            <Row label="Serviço">{appointment.service.name}</Row>
            <Row label="Profissional">{appointment.professional.name}</Row>
            <Row label="Data">{dateLabel}</Row>
            <Row label="Horário">
              {appointment.start}–{appointment.end}
            </Row>
            <Row label="Valor estimado">{formatCents(appointment.service.priceCents)}</Row>
            {appointment.seriesId ? (
              <Row label="Origem">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Repeat className="size-3.5" /> Série recorrente
                </span>
              </Row>
            ) : null}
            {appointment.notes ? <Row label="Observações">{appointment.notes}</Row> : null}
          </div>

          {!isTerminal ? (
            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap sm:justify-end">
              {canNoShow ? (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => changeStatus("no_show")}
                >
                  <UserX className="size-4" />
                  Não compareceu
                </Button>
              ) : null}
              <Button
                variant="outline"
                disabled={pending}
                className="text-destructive hover:text-destructive"
                onClick={() => setShowCancel(true)}
              >
                Cancelar agendamento
              </Button>
              {advance ? (
                <Button disabled={pending} onClick={() => changeStatus(advance.status)}>
                  {advance.icon}
                  {advance.label}
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCancel} onOpenChange={setShowCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O agendamento de {appointment.client.name} - {appointment.service.name} com{" "}
              {appointment.professional.name} em {dateLabel}, {appointment.start} será cancelado. O
              registro permanece no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                setShowCancel(false);
                void changeStatus("canceled");
              }}
              disabled={pending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Cancelar agendamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
