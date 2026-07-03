"use client";

import { useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Ban,
  CalendarClock,
  Check,
  CheckCheck,
  MoreVertical,
  Pencil,
  Play,
  Repeat,
  RotateCcw,
  StickyNote,
  UserX,
  X,
} from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getErrorMessage } from "@/lib/api-error";
import { formatCents } from "@/lib/format";
import { userInitials } from "@/lib/session";
import type { AppointmentStatus, AppointmentView } from "@gestarahub/contracts";
import { useCan } from "@/features/auth/session-provider";
import { useAppointment, useSetAppointmentStatus } from "../hooks/use-appointments";
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

// Duracao legivel a partir dos minutos do servico (ex.: 90 -> "1h30", 45 -> "45min").
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h${String(m).padStart(2, "0")}`;
  if (h) return `${h}h`;
  return `${m}min`;
}

// Linha compacta rotulo/valor (detalhes sob o hero).
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

interface AppointmentDetailDialogProps {
  appointment: AppointmentView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReschedule: (appointment: AppointmentView) => void;
  onEdit: (appointment: AppointmentView) => void;
}

export function AppointmentDetailDialog({
  appointment,
  open,
  onOpenChange,
  onReschedule,
  onEdit,
}: AppointmentDetailDialogProps) {
  const setStatusMut = useSetAppointmentStatus();
  const can = useCan();
  const canEdit = can("appointments:edit");
  const canReschedule = can("appointments:reschedule");
  const canCancel = can("appointments:cancel");
  const canStatus = can("appointments:status");
  const [showCancel, setShowCancel] = useState(false);
  const [showNoShow, setShowNoShow] = useState(false);
  // Le o dado vivo por id: reflete edicao/remarcacao feitas na modal aberta por
  // cima (as mutations invalidam a query e este detalhe re-renderiza).
  const liveQuery = useAppointment(appointment?.id ?? "");
  const pending = setStatusMut.isPending;

  if (!appointment) return null;

  // Prefere o dado vivo; cai no snapshot recebido ate a query de detalhe resolver.
  const data = liveQuery.data ?? appointment;

  const rawDate = format(parseISO(data.date), "EEEE, d 'de' MMMM", { locale: ptBR });
  const dateLabel = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
  const isTerminal =
    data.status === "completed" ||
    data.status === "canceled" ||
    data.status === "no_show";
  const advance = ADVANCE[data.status];
  const canNoShow = data.status === "pending" || data.status === "confirmed";
  const canNoShowAction = canStatus && canNoShow;
  // Acoes secundarias/destrutivas vivem no menu "Mais acoes".
  const hasMenuActions = canEdit || canReschedule || canNoShowAction || canCancel;

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
        <DialogContent
          className="sm:max-w-md"
          showCloseButton={false}
          // Nao fecha por clique/foco fora: evita que fechar o form/remarcacao
          // aberto por cima derrube tambem o detalhe (fecha por X, Esc ou acao).
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="size-11">
                  <AvatarFallback className="bg-secondary text-sm font-semibold">
                    {userInitials(data.client.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <DialogTitle className="flex flex-wrap items-center gap-2 text-left">
                    <span className="truncate">{data.client.name}</span>
                    <AppointmentStatusBadge status={data.status} />
                  </DialogTitle>
                </div>
              </div>
              <div className="-mt-1 -mr-1 flex shrink-0 items-center gap-0.5">
                {!isTerminal && hasMenuActions ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={pending}
                        aria-label="Mais ações"
                      >
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      {canEdit ? (
                        <DropdownMenuItem onSelect={() => onEdit(data)}>
                          <Pencil className="size-4" />
                          Editar
                        </DropdownMenuItem>
                      ) : null}
                      {canReschedule ? (
                        <DropdownMenuItem onSelect={() => onReschedule(data)}>
                          <CalendarClock className="size-4" />
                          Remarcar
                        </DropdownMenuItem>
                      ) : null}
                      {canNoShowAction ? (
                        <DropdownMenuItem onSelect={() => setShowNoShow(true)}>
                          <UserX className="size-4" />
                          Não compareceu
                        </DropdownMenuItem>
                      ) : null}
                      {canCancel ? (
                        <>
                          {canEdit || canReschedule || canNoShowAction ? (
                            <DropdownMenuSeparator />
                          ) : null}
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setShowCancel(true)}
                          >
                            <Ban className="size-4" />
                            Cancelar agendamento
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
                <DialogClose asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Fechar">
                    <X className="size-4" />
                  </Button>
                </DialogClose>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Hero: destaque do "quando" + servico como subtitulo. */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-base font-semibold leading-tight sm:text-lg">
                {dateLabel}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium tabular-nums">
                  {data.start} – {data.end}
                </span>
                <span className="rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                  {formatDuration(data.totalDurationMinutes)}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {data.services.map((s) => s.name).join(" + ")}
              </p>
            </div>

            {/* Detalhes compactos */}
            <div className="divide-y">
              <Row label="Profissional">{data.professional.name}</Row>
              <Row label="Valor estimado">
                <span className="font-semibold">
                  {formatCents(data.totalPriceCents)}
                </span>
              </Row>
            </div>

            {data.seriesId ||
            (data.rescheduledFrom && data.rescheduledFrom.length > 0) ||
            data.notes ? (
              <div className="space-y-1.5 border-t pt-3">
                {data.seriesId ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Repeat className="size-3.5 shrink-0" />
                    Faz parte de uma série recorrente
                  </p>
                ) : null}
                {data.rescheduledFrom &&
                data.rescheduledFrom.length > 0 ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RotateCcw className="size-3.5 shrink-0" />
                    Remarcado — originalmente{" "}
                    {format(parseISO(data.rescheduledFrom[0].date), "dd/MM")} às{" "}
                    {data.rescheduledFrom[0].start}
                  </p>
                ) : null}
                {data.notes ? (
                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    <StickyNote className="mt-0.5 size-3.5 shrink-0" />
                    <span>{data.notes}</span>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline" disabled={pending}>
                Fechar
              </Button>
            </DialogClose>
            {canStatus && advance ? (
              <Button disabled={pending} onClick={() => changeStatus(advance.status)}>
                {advance.icon}
                {advance.label}
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCancel} onOpenChange={setShowCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O agendamento de {data.client.name} - {data.services.map((s) => s.name).join(" + ")} com{" "}
              {data.professional.name} em {dateLabel}, {data.start} será cancelado. O
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
            >
              Cancelar agendamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showNoShow} onOpenChange={setShowNoShow}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como não compareceu?</AlertDialogTitle>
            <AlertDialogDescription>
              O agendamento de {data.client.name} - {data.services.map((s) => s.name).join(" + ")} com{" "}
              {data.professional.name} em {dateLabel}, {data.start} será marcado
              como não compareceu. O registro permanece no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                setShowNoShow(false);
                void changeStatus("no_show");
              }}
              disabled={pending}
            >
              Não compareceu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
