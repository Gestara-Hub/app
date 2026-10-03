"use client";

import { useState } from "react";
import { addDays, endOfMonth, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Lock,
  MoreVertical,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  Undo2,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type {
  PaymentMethod,
  TeacherPayoutAdjustment,
  TeacherPayoutStatus,
} from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { formatCents, formatDateTime, plural } from "@gestarahub/core/format";
import { InputCurrency, InputText, SelectField } from "@/components/form";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { InitialsAvatar } from "@/components/shared/list";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { paymentMethodLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useRetainedValue } from "@/lib/use-retained-value";
import type { TeacherPayDetailSession, TeacherPayoutDetail } from "@/services/teacherPayService";
import {
  useCloseTeacherPayout,
  useMarkTeacherPayoutPaid,
  useMarkTeacherPayoutUnpaid,
  useReopenTeacherPayout,
  useSaveTeacherPayoutAdjustments,
  useTeacherPayoutPreview,
} from "../hooks/use-teacher-pay";
import { competenceLabel, currentCompetence } from "../lib";
import {
  ADJUSTMENT_TYPES,
  ADJUSTMENT_TYPE_LABEL,
  adjustmentFormSchema,
  signedAdjustment,
  type AdjustmentFormValues,
} from "../teacher-pay-schema";
import { TeacherPayoutPayDialog } from "./teacher-payout-pay-dialog";
import {
  TeacherPayoutStatusBadge,
  payoutLineDetail,
  payoutLineTitle,
} from "./teacher-payout-status-badge";

const fullDate = (iso: string) => format(parseISO(iso), "dd/MM/yyyy");
const sessionDate = (iso: string) => format(parseISO(iso), "EEE, dd/MM", { locale: ptBR });

function signedCents(cents: number): string {
  return cents < 0 ? `− ${formatCents(-cents)}` : formatCents(cents);
}

interface TeacherPayoutDetailDialogProps {
  professionalId: string | null;
  competence: string;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigure: (professionalId: string) => void;
}

/** Detalhe do mes do professor: calculo, aulas contadas, ajustes e acoes. */
export function TeacherPayoutDetailDialog({
  professionalId,
  competence,
  canManage,
  onOpenChange,
  onConfigure,
}: TeacherPayoutDetailDialogProps) {
  // Guarda o ultimo professor enquanto o dialog anima a saida: com o id nulo a
  // query desliga, `data` some e o ramo de erro piscava antes de fechar.
  const shownId = useRetainedValue(professionalId) ?? null;
  const { data, isLoading, isError, refetch } = useTeacherPayoutPreview(shownId, competence);

  return (
    <Dialog open={professionalId !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[88vh] flex-col overflow-hidden p-0 sm:max-w-lg"
        showCloseButton={false}
        // Nao fecha por clique fora: evita perder o ajuste sendo digitado.
        onInteractOutside={(event) => event.preventDefault()}
      >
        {isLoading ? (
          <DetailSkeleton />
        ) : isError || !data ? (
          <div className="space-y-4 p-6">
            <DialogHeader>
              <DialogTitle>Pagamento do mês</DialogTitle>
              <DialogDescription>Não foi possível carregar o pagamento deste mês.</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="outline">Fechar</Button>
              </DialogClose>
              <Button onClick={() => void refetch()}>Tentar novamente</Button>
            </div>
          </div>
        ) : (
          <DetailContent
            // Remonta (fecha o formulario de ajuste) quando o status muda.
            key={`${data.professionalId}-${data.competence}-${data.status}`}
            data={data}
            canManage={canManage}
            onConfigure={onConfigure}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4 p-6" aria-busy="true">
      <DialogTitle className="sr-only">Carregando pagamento</DialogTitle>
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-full" />
        <Skeleton className="h-5 w-40" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

function DetailContent({
  data,
  canManage,
  onConfigure,
}: {
  data: TeacherPayoutDetail;
  canManage: boolean;
  onConfigure: (professionalId: string) => void;
}) {
  const closeMut = useCloseTeacherPayout();
  const reopenMut = useReopenTeacherPayout();
  const paidMut = useMarkTeacherPayoutPaid();
  const unpaidMut = useMarkTeacherPayoutUnpaid();
  const adjustMut = useSaveTeacherPayoutAdjustments();
  const pending =
    closeMut.isPending ||
    reopenMut.isPending ||
    paidMut.isPending ||
    unpaidMut.isPending ||
    adjustMut.isPending;
  const { confirm, dialog: confirmDialog } = useConfirmAction();
  const [payOpen, setPayOpen] = useState(false);

  const monthLabel = competenceLabel(data.competence);
  const isOpen = data.status === "open";
  const computedLines = data.lines.filter((l) => l.kind !== "adjustment");

  // Ajustes salvos no registro: editaveis no mes aberto; congelados no fechado/pago.
  const adjustments: TeacherPayoutAdjustment[] = data.lines
    .filter((l) => l.kind === "adjustment")
    .map((l) => ({ label: l.label, amountCents: l.amountCents }));
  const computedTotal = computedLines.reduce((sum, l) => sum + l.amountCents, 0);
  const rawTotal = isOpen
    ? computedTotal + adjustments.reduce((sum, a) => sum + a.amountCents, 0)
    : data.totalCents;
  const negative = isOpen && rawTotal < 0;
  // Mes que ainda nao comecou nao pode ser fechado (o service tambem recusa).
  const future = data.competence > currentCompetence();
  // Mes corrente: fechar agora deixa de fora o que ainda acontece ate o ultimo dia.
  const running = data.competence === currentCompetence();
  const monthEnd = endOfMonth(parseISO(`${data.competence}-01`));
  const lastDayLabel = format(monthEnd, "dd/MM");
  const nextMonthStartLabel = format(addDays(monthEnd, 1), "dd/MM");
  const upcomingCount = data.upcomingSessions.length;
  const shownTotal = Math.max(0, rawTotal);

  const saveAdjustments = async (next: TeacherPayoutAdjustment[], success: string) => {
    try {
      await adjustMut.mutateAsync({
        professionalId: data.professionalId,
        competence: data.competence,
        adjustments: next,
      });
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível salvar o ajuste."));
      return false;
    }
  };

  const removeAdjustment = async (index: number) => {
    const target = adjustments[index];
    if (!target) return;
    const ok = await confirm({
      title: "Remover ajuste?",
      description: `O ajuste "${target.label}" (${signedCents(target.amountCents)}) sai da prévia de ${data.professionalName}.`,
      confirmLabel: "Remover ajuste",
      variant: "destructive",
    });
    if (!ok) return;
    await saveAdjustments(
      adjustments.filter((_, j) => j !== index),
      "Ajuste removido.",
    );
  };

  const closeMonth = async () => {
    const frozen = `O pagamento de ${data.professionalName} fica congelado em ${formatCents(shownTotal)}${adjustments.length > 0 ? `, com ${plural(adjustments.length, "ajuste", "ajustes")}` : ""}. Correções posteriores de aulas ou matrículas não mudam o valor; para recalcular, reabra o mês.`;
    const ok = await confirm({
      title: `Fechar ${monthLabel}?`,
      description: running ? (
        <>
          <span className="mb-2 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-foreground">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              {monthLabel} ainda não terminou.{" "}
              {upcomingCount > 0
                ? `${plural(upcomingCount, "aula prevista", "aulas previstas")} até ${lastDayLabel} ${upcomingCount === 1 ? "fica" : "ficam"} de fora`
                : `O que acontecer até ${lastDayLabel} fica de fora`}
              , assim como matrículas e mensalidades pagas até lá.
            </span>
          </span>
          {frozen}
        </>
      ) : (
        frozen
      ),
      confirmLabel: "Fechar mês",
      variant: "default",
    });
    if (!ok) return;
    try {
      await closeMut.mutateAsync({
        professionalId: data.professionalId,
        competence: data.competence,
        adjustments,
      });
      toast.success("Mês fechado.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível fechar o mês."));
    }
  };

  const reopenMonth = async () => {
    if (!data.payout) return;
    const ok = await confirm({
      title: `Reabrir ${monthLabel}?`,
      description: `O valor de ${data.professionalName} volta a ser uma prévia recalculada com os dados atuais. Os ajustes são mantidos.`,
      confirmLabel: "Reabrir mês",
      variant: "default",
    });
    if (!ok) return;
    try {
      await reopenMut.mutateAsync(data.payout.id);
      toast.success("Mês reaberto.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível reabrir o mês."));
    }
  };

  const pay = async (method: PaymentMethod) => {
    if (!data.payout) return;
    try {
      await paidMut.mutateAsync({ id: data.payout.id, method });
      toast.success(`Pagamento registrado (${paymentMethodLabel(method)}).`);
      setPayOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível registrar o pagamento."));
    }
  };

  const undoPayment = async () => {
    if (!data.payout) return;
    const ok = await confirm({
      title: "Desfazer pagamento?",
      description: `O pagamento de ${data.professionalName} (${formatCents(data.totalCents)}) volta para fechado e sai do caixa${data.payout.method ? `; o registro via ${paymentMethodLabel(data.payout.method)} é apagado` : ""}.`,
      confirmLabel: "Desfazer pagamento",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await unpaidMut.mutateAsync(data.payout.id);
      toast.success("Pagamento desfeito.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível desfazer o pagamento."));
    }
  };

  const hasMenu = canManage && (data.status === "closed" || data.status === "paid" || Boolean(data.rule));

  const hasFooter = canManage && (isOpen || data.status === "closed");

  return (
    <>
      <DialogHeader className="shrink-0 p-6 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <InitialsAvatar name={data.professionalName} className="size-11" />
            <div className="min-w-0">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-left">
                <span className="truncate">{data.professionalName}</span>
                <TeacherPayoutStatusBadge status={data.status} />
              </DialogTitle>
              <DialogDescription className="text-left">{monthLabel}</DialogDescription>
            </div>
          </div>
          <div className="-mt-1 -mr-1 flex shrink-0 items-center gap-0.5">
            {hasMenu ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" disabled={pending} aria-label="Mais ações">
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {data.rule ? (
                    <DropdownMenuItem onSelect={() => onConfigure(data.professionalId)}>
                      <Settings2 className="size-4" />
                      Editar regra
                    </DropdownMenuItem>
                  ) : null}
                  {data.status === "closed" ? (
                    <DropdownMenuItem onSelect={() => void reopenMonth()}>
                      <RotateCcw className="size-4" />
                      Reabrir mês
                    </DropdownMenuItem>
                  ) : null}
                  {data.status === "paid" ? (
                    <DropdownMenuItem variant="destructive" onSelect={() => void undoPayment()}>
                      <Undo2 className="size-4" />
                      Desfazer pagamento
                    </DropdownMenuItem>
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

      <DialogBody className="space-y-5" scrollCueLabel="Mais detalhes abaixo">
        {/* Etapas do mes + o que fazer agora. */}
        <PayoutSteps status={data.status} />
        {canManage ? (
          <NextStepHint
            status={data.status}
            future={future}
            running={running}
            monthLabel={monthLabel}
            nextMonthStartLabel={nextMonthStartLabel}
            dueDate={data.dueDate}
          />
        ) : null}

        {/* Hero: valor do mes + vencimento e regra. */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-xs font-medium text-muted-foreground">
            {isOpen ? "Prévia do mês" : data.status === "paid" ? "Valor pago" : "Valor a pagar"}
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums leading-tight">
            {formatCents(shownTotal)}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {data.status === "paid" && data.payout?.paidAt
              ? `Pago em ${formatDateTime(data.payout.paidAt)}${data.payout.method ? ` via ${paymentMethodLabel(data.payout.method)}` : ""}`
              : `Vence em ${fullDate(data.dueDate)}`}
          </p>
          {data.ruleSummary ? (
            <p className="mt-2 text-sm text-foreground/80">{data.ruleSummary}</p>
          ) : null}
        </div>

        {!isOpen ? (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Valores congelados no fechamento
              {data.payout?.closedAt ? ` (${formatDateTime(data.payout.closedAt)})` : ""}. A lista de aulas abaixo
              mostra os dados atuais.
            </span>
          </p>
        ) : null}

        {/* Linhas do calculo */}
        <section className="space-y-1.5">
          <h3 className="text-sm font-semibold">Cálculo</h3>
          <div className="divide-y rounded-lg border">
            {computedLines.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">Nenhuma parte calculada.</p>
            ) : (
              computedLines.map((line, i) => (
                <div key={`${line.kind}-${i}`} className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{payoutLineTitle(line)}</p>
                    {payoutLineDetail(line) ? (
                      <p className="text-xs text-muted-foreground">{payoutLineDetail(line)}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">{formatCents(line.amountCents)}</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Ajustes */}
        <section className="space-y-1.5">
          <h3 className="text-sm font-semibold">Ajustes</h3>
          {adjustments.length > 0 ? (
            <div className="divide-y rounded-lg border">
              {adjustments.map((a, i) => (
                <div key={`${a.label}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{a.label}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        a.amountCents < 0 ? "text-destructive" : "text-success",
                      )}
                    >
                      {signedCents(a.amountCents)}
                    </span>
                    {isOpen && canManage ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remover ajuste ${a.label}`}
                        disabled={pending}
                        onClick={() => void removeAdjustment(i)}
                      >
                        <Trash2 />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isOpen ? "Bônus, desconto ou vale entram aqui antes de fechar o mês." : "Sem ajustes."}
            </p>
          )}
          {isOpen && canManage ? (
            <AdjustmentForm
              disabled={pending}
              onAdd={(a) => saveAdjustments([...adjustments, a], "Ajuste salvo.")}
            />
          ) : null}
          {negative ? (
            <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              Os descontos deixam o total do mês negativo.
            </p>
          ) : null}
        </section>

        {/* Aulas contadas */}
        <SessionsSection
          title="Aulas contadas"
          empty="Nenhuma aula dada por ele neste mês até agora."
          sessions={data.sessions}
          highlightSubstitute
        />
        {isOpen && upcomingCount > 0 ? (
          <SessionsSection
            title={`Aulas previstas até ${lastDayLabel} (entram quando acontecerem)`}
            sessions={data.upcomingSessions}
            muted
          />
        ) : null}
        {data.substitutedSessions.length > 0 ? (
          <SessionsSection
            title="Aulas dele dadas por substituto (não contam)"
            sessions={data.substitutedSessions}
            muted
          />
        ) : null}
      </DialogBody>

      {/* Uma acao principal por etapa; fechar o modal fica no X do cabecalho. */}
      {hasFooter ? (
        <div className="flex shrink-0 flex-col gap-2 border-t border-border/40 bg-background p-6 pt-4 sm:flex-row sm:justify-end">
          {isOpen ? (
            <Button
              disabled={pending || negative || future}
              title={future ? "Este mês ainda não começou." : undefined}
              onClick={() => void closeMonth()}
            >
              <CheckCircle2 className="size-4" />
              Fechar mês
            </Button>
          ) : (
            <Button disabled={pending} onClick={() => setPayOpen(true)}>
              <Wallet className="size-4" />
              Pagar
            </Button>
          )}
        </div>
      ) : null}

      {confirmDialog}
      <TeacherPayoutPayDialog
        open={payOpen}
        teacherName={data.professionalName}
        monthLabel={monthLabel}
        totalCents={data.totalCents}
        isPending={paidMut.isPending}
        onOpenChange={setPayOpen}
        onConfirm={(method) => void pay(method)}
      />
    </>
  );
}

const STEPS: { status: Exclude<TeacherPayoutStatus, "canceled">; label: string }[] = [
  { status: "open", label: "Prévia" },
  { status: "closed", label: "Fechado" },
  { status: "paid", label: "Pago" },
];

/** Prévia → Fechado → Pago, com a etapa atual marcada. */
function PayoutSteps({ status }: { status: TeacherPayoutStatus }) {
  const currentIndex = STEPS.findIndex((s) => s.status === status);
  return (
    <ol className="flex items-center gap-2" aria-label="Etapas do pagamento">
      {STEPS.map((step, i) => {
        const done = i < currentIndex || status === "paid";
        const current = i === currentIndex && status !== "paid";
        return (
          <li key={step.status} className="flex flex-1 items-center gap-2 last:flex-none">
            <span
              aria-current={current ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap",
                done ? "text-success" : current ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-5 items-center justify-center rounded-full border text-[11px] tabular-nums",
                  done
                    ? "border-success/40 bg-success/10"
                    : current
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border",
                )}
              >
                {done ? <Check className="size-3" /> : i + 1}
              </span>
              {step.label}
            </span>
            {i < STEPS.length - 1 ? (
              <span
                aria-hidden
                className={cn("h-px flex-1", i < currentIndex ? "bg-success/40" : "bg-border")}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** O que fazer agora na etapa do mes (so para quem gerencia). */
function NextStepHint({
  status,
  future,
  running,
  monthLabel,
  nextMonthStartLabel,
  dueDate,
}: {
  status: TeacherPayoutStatus;
  future: boolean;
  running: boolean;
  monthLabel: string;
  nextMonthStartLabel: string;
  dueDate: string;
}) {
  let text: string;
  if (status === "paid") {
    text = "Mês concluído. Para corrigir, desfaça o pagamento em Mais ações.";
  } else if (status === "closed") {
    const overdue = dueDate < format(new Date(), "yyyy-MM-dd");
    text = overdue
      ? `Valor congelado. O pagamento venceu em ${fullDate(dueDate)}; registre em Pagar.`
      : `Valor congelado. Registre o pagamento em Pagar até ${fullDate(dueDate)}.`;
  } else if (future) {
    text = `${monthLabel} ainda não começou. A prévia se forma conforme as aulas acontecem.`;
  } else if (running) {
    text = `${monthLabel} está em andamento. Feche a partir de ${nextMonthStartLabel} para contar o mês inteiro; o fechamento libera o pagamento.`;
  } else {
    text = "Revise as aulas e os ajustes e feche o mês. O fechamento congela o valor e libera o pagamento.";
  }
  return <p className="-mt-2 text-sm text-muted-foreground">{text}</p>;
}

function SessionsSection({
  title,
  empty,
  sessions,
  highlightSubstitute = false,
  muted = false,
}: {
  title: string;
  empty?: string;
  sessions: TeacherPayDetailSession[];
  highlightSubstitute?: boolean;
  muted?: boolean;
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-sm font-semibold">
        {title} <span className="font-normal text-muted-foreground">({sessions.length})</span>
      </h3>
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className={cn("divide-y rounded-lg border", muted && "opacity-80")}>
          {sessions.map((s) => {
            const asSubstitute = s.instructorId !== s.primaryInstructorId;
            return (
              <li key={s.sessionId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.className}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {sessionDate(s.date)} · {s.start}
                  </p>
                </div>
                {highlightSubstitute && asSubstitute ? (
                  <span
                    className="shrink-0 rounded-full border border-info/25 bg-info/10 px-2 py-0.5 text-[11px] font-medium text-info"
                    title={`Substituindo ${s.primaryInstructorName}`}
                  >
                    Substituição
                  </span>
                ) : null}
                {muted ? (
                  <span className="shrink-0 text-xs text-muted-foreground">por {s.instructorName}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const ADJUSTMENT_OPTIONS = ADJUSTMENT_TYPES.map((t) => ({ value: t, label: ADJUSTMENT_TYPE_LABEL[t] }));

function AdjustmentForm({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  /** Resolve `true` quando o ajuste foi salvo (so entao o formulario fecha). */
  onAdd: (adjustment: TeacherPayoutAdjustment) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { type: "bonus", label: "", amountCents: 0 },
  });

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Adicionar ajuste
      </Button>
    );
  }

  const submit = form.handleSubmit(async (values) => {
    const saved = await onAdd({ label: values.label.trim(), amountCents: signedAdjustment(values) });
    if (!saved) return;
    form.reset({ type: values.type, label: "", amountCents: 0 });
    setOpen(false);
  });

  return (
    <FormProvider {...form}>
      <form
        onSubmit={(event) => {
          event.stopPropagation();
          void submit(event);
        }}
        noValidate
        className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr]">
          <SelectField<AdjustmentFormValues>
            name="type"
            id="adjustment-type"
            label="Tipo"
            options={ADJUSTMENT_OPTIONS}
            clearable={false}
            required
            disabled={disabled}
          />
          <InputText<AdjustmentFormValues>
            name="label"
            id="adjustment-label"
            label="Descrição"
            placeholder="Descreva o ajuste"
            required
            disabled={disabled}
          />
        </div>
        <InputCurrency<AdjustmentFormValues>
          name="amountCents"
          id="adjustment-amount"
          label="Valor"
          required
          disabled={disabled}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={disabled || form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Salvando..." : "Adicionar"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
