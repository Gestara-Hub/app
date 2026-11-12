"use client";

import { Fragment, useState } from "react";
import { format, parseISO } from "date-fns";
import { EventSignupLink } from "./event-signup-link";
import { useWhatsAppSend } from "@/features/communication";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpCircle, Award, CalendarDays, ClipboardList, ListChecks, Pencil, Send, Ticket, User, UserPlus, Users, Wallet, XCircle } from "lucide-react";
import type { EventRegistrationView, EventSession } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { formatCents, plural } from "@gestarahub/core/format";
import { todayISO } from "@gestarahub/core/date";
import { BackLink } from "@/components/shared/back-link";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { ListItemActionsMenu, ListItemContextMenu, type ListItemAction } from "@/components/shared/list-item-actions-menu";
import { ListContainer, ListRow } from "@/components/shared/list";
import { PageActionsMenu } from "@/components/shared/page-actions-menu";
import { PageTabs } from "@/components/shared/page-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useCan, useCurrentUser, useHasFeature } from "@/features/auth";
import { isSupabaseOrganization } from "@/lib/session";
import { useCancelEvent, useCancelEventRegistration, useCancelEventSession, useEvent, useEventRegistrations } from "../hooks/use-events";
import { billingSummary, datesLabel, dayLabel, hoursLabel, instructorsLabel, occupancyLabel, sessionInstructors, sessionTimeLabel } from "../event-copy";
import { EventFormDrawer } from "./event-form-drawer";
import { EventStatusBadge } from "./event-badges";
import { RegisterDrawer } from "./register-drawer";
import { EventFinanceTab } from "./event-finance-tab";

type Tab = "registered" | "waitlist" | "days" | "finance";

function paymentLabel(r: EventRegistrationView): { text: string; tone: string } {
  if (r.amountCents === 0) return { text: "Sem cobrança", tone: "text-muted-foreground" };
  if (r.overdueCents > 0) return { text: `${formatCents(r.overdueCents)} vencido`, tone: "text-red-600 dark:text-red-400" };
  if (r.openCents > 0) return { text: `${formatCents(r.openCents)} a receber`, tone: "text-amber-700 dark:text-amber-400" };
  return { text: "Pago", tone: "text-emerald-700 dark:text-emerald-400" };
}

export function EventDetailView({ id }: { id: string }) {
  const router = useRouter();
  const whatsapp = useWhatsAppSend();
  const can = useCan();
  const canManage = can("events:manage");
  const canEnroll = can("enrollment:manage");
  const canSeeMoney = can("billing:view");
  const hasCertificates = useHasFeature()("certificates");
  const serverDocuments = isSupabaseOrganization(useCurrentUser().organizationId);
  const { data: event, isPending, isError } = useEvent(id);
  const { data: registrations } = useEventRegistrations(id);
  // `?tab=waitlist` (aviso "vaga aberta" do sino) abre direto na espera.
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => (searchParams.get("tab") === "waitlist" ? "waitlist" : "registered"));
  const [editOpen, setEditOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [promote, setPromote] = useState<EventRegistrationView | undefined>();
  const cancelEventMut = useCancelEvent();
  const cancelSessionMut = useCancelEventSession();
  const cancelRegistrationMut = useCancelEventRegistration();
  const { confirm, dialog } = useConfirmAction();

  if (isError) {
    return (
      <>
        <BackLink fallbackHref="/events" />
        <p className="text-sm text-muted-foreground">Evento não encontrado.</p>
      </>
    );
  }
  if (isPending || !event) {
    return (
      <>
        <BackLink fallbackHref="/events" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        <Skeleton className="mt-6 h-40 w-full rounded-lg" />
      </>
    );
  }

  const all = registrations ?? [];
  // Reservada ("vaga so com o pagamento") aparece nos inscritos, com o selo do prazo.
  const confirmed = all.filter((r) => r.status === "confirmed" || r.status === "reserved");
  const waiting = all.filter((r) => r.status === "waitlist");
  const canceled = all.filter((r) => r.status === "canceled");
  const active = event.status === "active";
  const open = active && event.stage !== "finished";
  const today = todayISO();

  const cancelEvent = async () => {
    const ok = await confirm({
      title: `Cancelar ${event.name}?`,
      description:
        confirmed.length > 0
          ? `${plural(confirmed.length, "inscrição", "inscrições")} e as parcelas que ainda vão vencer são canceladas. O que já foi pago fica.`
          : "Os dias do evento saem do calendário.",
      confirmLabel: "Cancelar evento",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await cancelEventMut.mutateAsync({ id: event.id });
      toast.success("Evento cancelado.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível cancelar o evento."));
    }
  };

  const cancelDay = async (session: EventSession) => {
    const ok = await confirm({
      title: `Cancelar o dia ${dayLabel(session.date)}?`,
      description: "O dia sai do calendário. As inscrições continuam.",
      confirmLabel: "Cancelar dia",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await cancelSessionMut.mutateAsync({ sessionId: session.id });
      toast.success("Dia cancelado.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível cancelar o dia."));
    }
  };

  const cancelRegistration = async (r: EventRegistrationView) => {
    const waiting = r.status === "waitlist";
    const ok = await confirm({
      title: waiting ? `Tirar ${r.studentName} da espera?` : `Cancelar a inscrição de ${r.studentName}?`,
      description: waiting
        ? "O aluno sai da lista de espera."
        : r.openCents > 0
          ? "As parcelas que ainda vão vencer são canceladas. O que já foi pago e o que já venceu ficam."
          : "O que já foi pago fica.",
      confirmLabel: waiting ? "Tirar da espera" : "Cancelar inscrição",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await cancelRegistrationMut.mutateAsync({ registrationId: r.id });
      toast.success(waiting ? "Saiu da lista de espera." : "Inscrição cancelada.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível cancelar."));
    }
  };

  const finished = active && event.stage === "finished";
  const pageActions: ListItemAction[] = [
    ...(canManage && active ? [{ key: "edit", label: "Editar", icon: <Pencil className="size-4" />, onSelect: () => setEditOpen(true) }] : []),
    // Certificados de participacao (Pro): todos os presentes num PDF (conta real) ou numa tela de impressao.
    ...(finished && confirmed.some((r) => r.presentCount > 0)
      ? [
          {
            key: "certificates",
            label: "Certificados",
            icon: <Award className="size-4" />,
            onSelect: () => {
              if (hasCertificates && serverDocuments) window.open(`/api/documents/certificates/event/${event.id}`, "_blank", "noopener");
              else router.push(`/events/${event.id}/certificates`);
            },
          },
        ]
      : []),
    ...(canManage && open
      ? [{ key: "cancel", label: "Cancelar evento", icon: <XCircle className="size-4" />, destructive: true, onSelect: () => void cancelEvent() }]
      : []),
  ];

  const meta = [
    datesLabel(event),
    hoursLabel(event.totalHours),
    instructorsLabel(event.instructors),
    occupancyLabel(event),
    billingSummary(event),
    ...(event.countsForProgression ? ["Conta para a graduação"] : []),
  ];

  const tabs = [
    { value: "registered" as const, label: `Inscritos (${confirmed.length})`, icon: Users },
    ...(waiting.length > 0 ? [{ value: "waitlist" as const, label: `Espera (${waiting.length})`, icon: ListChecks }] : []),
    { value: "days" as const, label: `Dias (${event.sessions.filter((s) => s.status !== "canceled").length})`, icon: CalendarDays },
    ...(canSeeMoney ? [{ value: "finance" as const, label: "Financeiro", icon: Wallet }] : []),
  ];
  const activeTab = tab === "waitlist" && waiting.length === 0 ? "registered" : tab;

  const registrationRow = (r: EventRegistrationView) => {
    const pay = paymentLabel(r);
    // Endereco montado no clique (no servidor nao ha `window`).
    const ticketUrl = r.status === "confirmed" && r.ticketCode ? () => `${window.location.origin}/p/i/${r.ticketCode}` : null;
    const actions: ListItemAction[] = [
      // Ingresso (doc product/29 T7): abrir e mandar pelo WhatsApp.
      ...(ticketUrl
        ? [
            { key: "ticket", label: "Ver ingresso", icon: <Ticket className="size-4" />, onSelect: () => window.open(ticketUrl(), "_blank", "noopener") },
            {
              key: "send-ticket",
              label: "Enviar ingresso",
              icon: <Send className="size-4" />,
              onSelect: () =>
                whatsapp.send({
                  trigger: "manual_broadcast",
                  recipient: { name: r.studentName, phone: r.studentPhone, clientId: r.studentId },
                  content: `Olá, ${r.studentName.split(" ")[0]}! Seu ingresso para ${event.name}: ${ticketUrl()}`,
                }),
            },
          ]
        : []),
      ...(finished && r.status === "confirmed" && r.presentCount > 0
        ? [{ key: "certificate", label: "Certificado", icon: <Award className="size-4" />, onSelect: () => router.push(`/events/${event.id}/certificate/${r.id}`) }]
        : []),
      ...(canEnroll && r.status === "waitlist" && open && !event.isFull
        ? [
            {
              key: "promote",
              label: "Promover",
              icon: <ArrowUpCircle className="size-4" />,
              onSelect: () => {
                setPromote(r);
                setRegisterOpen(true);
              },
            },
          ]
        : []),
      ...(canEnroll && r.status !== "canceled"
        ? [
            {
              key: "cancel",
              label: r.status === "waitlist" ? "Tirar da espera" : "Cancelar inscrição",
              icon: <XCircle className="size-4" />,
              destructive: true,
              onSelect: () => void cancelRegistration(r),
            },
          ]
        : []),
    ];
    const row = (
      <ListRow
        key={r.id}
        onClick={() => router.push(`/clients/${r.studentId}`)}
        canClick
        actions={actions.length > 0 ? <ListItemActionsMenu actions={actions} title={`Ações de ${r.studentName}`} variant="ghost" /> : null}
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 break-words text-sm font-medium text-foreground">{r.studentName}</p>
          {r.scope === "days" ? (
            <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {plural(r.sessionIds?.length ?? 0, "dia", "dias")}
            </span>
          ) : null}
          {r.status === "canceled" ? (
            <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Cancelada
            </span>
          ) : null}
          {r.status === "reserved" && r.holdUntil ? (
            <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
              Reservada até {format(parseISO(r.holdUntil), "HH:mm")}
            </span>
          ) : null}
          {r.source === "public_link" ? (
            <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              Pelo link
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
          {r.status !== "waitlist" ? <span className={cn("font-medium", pay.tone)}>{pay.text}</span> : <span>Aguardando vaga</span>}
          {r.status === "confirmed" && event.stage !== "upcoming" ? <span>{plural(r.presentCount, "presença", "presenças")}</span> : null}
        </div>
      </ListRow>
    );
    return actions.length > 0 ? (
      <ListItemContextMenu key={r.id} actions={actions}>
        {row}
      </ListItemContextMenu>
    ) : (
      row
    );
  };

  return (
    <>
      {dialog}
      <BackLink fallbackHref="/events" />
      <div className="mb-6 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{event.name}</h1>
              <EventStatusBadge event={event} />
              {event.modalityName ? (
                <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {event.modalityName}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {meta.map((part, i) => (
                <Fragment key={`${i}-${part}`}>
                  {i > 0 ? " · " : null}
                  <span className={part.length <= 24 ? "whitespace-nowrap" : undefined}>{part}</span>
                </Fragment>
              ))}
            </p>
            {event.description ? <p className="min-w-0 break-words pt-1 text-sm text-foreground/80">{event.description}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {pageActions.length > 0 ? <PageActionsMenu label="Mais ações do evento" actions={pageActions} /> : null}
            {canEnroll && open ? (
              <Button
                className="hidden sm:inline-flex"
                onClick={() => {
                  setPromote(undefined);
                  setRegisterOpen(true);
                }}
              >
                <UserPlus className="size-4" />
                Inscrever
              </Button>
            ) : null}
          </div>
        </div>
        {canEnroll && open ? (
          <Button
            className="w-full sm:hidden"
            onClick={() => {
              setPromote(undefined);
              setRegisterOpen(true);
            }}
          >
            <UserPlus className="size-4" />
            Inscrever
          </Button>
        ) : null}
      </div>

      {canManage && open ? <EventSignupLink event={event} /> : null}

      <EventFormDrawer open={editOpen} onOpenChange={setEditOpen} event={event} />
      <RegisterDrawer open={registerOpen} onOpenChange={setRegisterOpen} event={event} registrations={all} promote={promote} />

      <PageTabs tabs={tabs} value={activeTab} onChange={setTab} label="Seções do evento" idPrefix="event" className="mb-4" />

      {activeTab === "registered" ? (
        <section className="space-y-3">
          <ListContainer
            emptyState={
              confirmed.length + canceled.length > 0 ? undefined : (
                <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                  <Users className="size-8 stroke-[1.5]" />
                  <p className="text-sm font-medium">Ninguém inscrito ainda.</p>
                  {canEnroll && open ? <p className="text-xs">Use &ldquo;Inscrever&rdquo; para adicionar alunos ou visitantes.</p> : null}
                </div>
              )
            }
          >
            {confirmed.length + canceled.length > 0 ? [...confirmed, ...canceled].map(registrationRow) : null}
          </ListContainer>
        </section>
      ) : activeTab === "waitlist" ? (
        <section className="space-y-3">
          <ListContainer>{waiting.map(registrationRow)}</ListContainer>
        </section>
      ) : activeTab === "finance" ? (
        <EventFinanceTab event={event} />
      ) : (
        <section className="space-y-3">
          <ListContainer>
            {event.sessions.map((s) => {
              const canceledDay = s.status === "canceled";
              const past = s.date < today;
              const actions: ListItemAction[] =
                canManage && active && !canceledDay && !past
                  ? [{ key: "cancel", label: "Cancelar dia", icon: <XCircle className="size-4" />, destructive: true, onSelect: () => void cancelDay(s) }]
                  : [];
              const row = (
                <ListRow
                  key={s.id}
                  onClick={canceledDay ? undefined : () => router.push(`/events/sessions/${encodeURIComponent(s.id)}`)}
                  canClick={!canceledDay}
                  actions={actions.length > 0 ? <ListItemActionsMenu actions={actions} title={`Ações do dia ${dayLabel(s.date)}`} variant="ghost" /> : null}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn("text-sm font-medium", canceledDay ? "text-muted-foreground line-through" : "text-foreground")}>{dayLabel(s.date)}</p>
                    <span className="text-sm text-muted-foreground">{sessionTimeLabel(s)}</span>
                    {canceledDay ? (
                      <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Cancelado
                      </span>
                    ) : s.date === today ? (
                      <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        Hoje
                      </span>
                    ) : null}
                  </div>
                  {!canceledDay ? (
                    <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
                      {/* Mais de uma pessoa no evento: cada dia mostra quem conduz o bloco. */}
                      {event.instructors.length > 1 ? (
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <User className="size-3 shrink-0 text-muted-foreground/60" />
                          <span className="min-w-0 break-words">{instructorsLabel(sessionInstructors(event, s))}</span>
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1.5">
                        <ClipboardList className="size-3 text-muted-foreground/60" />
                        <span>{past || s.date === today ? "Chamada" : "Abre a chamada no dia"}</span>
                      </span>
                    </div>
                  ) : null}
                </ListRow>
              );
              return actions.length > 0 ? (
                <ListItemContextMenu key={s.id} actions={actions}>
                  {row}
                </ListItemContextMenu>
              ) : (
                row
              );
            })}
          </ListContainer>
          {event.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem dias. <Link href="#" onClick={() => setEditOpen(true)}>Edite o evento</Link> para adicionar.
            </p>
          ) : null}
        </section>
      )}
    </>
  );
}
