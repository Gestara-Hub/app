"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import { AlertCircle, MessageCircle } from "lucide-react";
import { paymentMethodLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { formatCents, formatDate } from "@gestarahub/core/format";
import type { ChargeKind, ChargeStatus, ChargeView, PlanPeriod } from "@gestarahub/contracts";
import { withKind } from "@/lib/text";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useOnlineCheckout } from "../hooks/use-billing";
import { dateInSpace, todayISO } from "@gestarahub/core/date";

/**
 * Pecas da linha de cobranca, as mesmas em Cobrancas e no extrato da ficha do
 * aluno: rotulos e cores de situacao, selos, valor e os textos da linha.
 */

export const STATUS_LABEL: Record<ChargeStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Atrasado",
  canceled: "Cancelado",
  waived: "Isento",
};

/**
 * Uma cor por situacao no sistema todo (10/11/2026): pendente ambar, pago verde,
 * em atraso vermelho, isento azul claro, cancelado e encerrado cinza. O selo
 * leva um ponto da cor (`status-dot`, globals.css) para ler antes do texto.
 */
export const STATUS_CLASS: Record<ChargeStatus, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  paid: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  overdue: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400",
  // Sem riscado no selo: o texto riscado ficava ilegivel (COB-25). Cinza desde
  // 10/11/2026 (o ambar passou a ser do pendente).
  canceled: "border-border/60 bg-muted/50 text-muted-foreground",
  waived: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
};

/** Cancelada pelo sistema (troca de plano/regra, inativacao, saida da aula) nao reabre. */
export const SYSTEM_CANCELED_HINT =
  "Encerrada automaticamente pelo sistema (troca de plano ou de regra, inativação ou saída da aula). Não pode ser reaberta.";
export const isSystemCanceled = (c: ChargeView) => c.canceledBy === "system";

/** Substituida: cancelada pelo sistema porque outra cobranca tomou o lugar. */
export const isReplaced = (c: ChargeView) => c.status === "canceled" && Boolean(c.replaced);
export const REPLACED_CLASS = "border-border/60 bg-muted/40 text-muted-foreground";
export const statusLabelOf = (c: ChargeView) =>
  isReplaced(c) ? "Substituída" : isSystemCanceled(c) ? "Encerrado" : STATUS_LABEL[c.status];
export const statusClassOf = (c: ChargeView) =>
  isReplaced(c) || isSystemCanceled(c) ? REPLACED_CLASS : STATUS_CLASS[c.status];

export const PERIOD_UNIT: Record<PlanPeriod, string> = {
  monthly: "mês",
  biweekly: "quinzena",
  weekly: "semana",
};

export const shortDate = (iso: string) => format(parseISO(iso), "dd/MM");
/** "dd/MM" no ano atual; de outro ano, "dd/MM/aaaa" (atrasos antigos). */
const dueDateLabel = (iso: string) =>
  iso.slice(0, 4) === String(new Date().getFullYear()) ? shortDate(iso) : format(parseISO(iso), "dd/MM/yyyy");

/** D8: pago online ou por Pix Automatico nao se desfaz (seria estorno). */
export const isPaidOnline = (c: ChargeView) =>
  c.status === "paid" && (c.paidVia === "online" || c.paidVia === "recurring");

export const PAID_RECURRING_HINT =
  "Pago pelo Pix Automático: não pode ser desfeito, porque seria um estorno (não existe nesta versão).";

const PAID_VIA_CLASS =
  "inline-flex shrink-0 items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] leading-none font-medium text-primary";

/**
 * Selo de como a cobranca paga foi recebida (so online / Pix Automatico).
 * "Pago online" abre o acerto: quanto o aluno pagou, as taxas e quanto entrou.
 */
export function PaidViaBadge({ charge }: { charge: ChargeView }) {
  if (charge.status !== "paid") return null;
  if (charge.paidVia === "recurring") return <span className={PAID_VIA_CLASS}>Pix Automático</span>;
  if (charge.paidVia !== "online") return null;
  return (
    <OnlineSettlementPopover charge={charge}>
      <button
        type="button"
        aria-label="Ver quando o aluno pagou, as taxas e quanto entrou"
        className={cn(PAID_VIA_CLASS, "cursor-pointer hover:bg-primary/20")}
        onClick={(event) => event.stopPropagation()}
      >
        Pago online
      </button>
    </OnlineSettlementPopover>
  );
}

// Neutro (10/11/2026): e informacao, nao situacao; a cor fica so para a situacao.
const WHATSAPP_BADGE_CLASS =
  "inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-muted/40 font-medium text-muted-foreground";

const TRIGGER_LABELS: Record<string, string> = {
  billing_before_due: "Lembrete antes do vencimento",
  billing_due_date: "Cobrança no vencimento",
  billing_after_due: "Aviso de atraso",
  billing_critical: "Aviso de atraso crítico",
  manual_broadcast: "Mensagem avulsa",
};

const STATUS_LABELS: Record<string, string> = {
  delivered: "Entregue",
  read: "Lida",
  sent: "Enviada",
  opened: "Aberta no WhatsApp",
  queued: "Na fila",
  failed: "Falhou",
};

/**
 * Selo discreto indicando que a cobrança já teve notificação/lembrete de WhatsApp
 * enviado automaticamente pelo sistema (ou manualmente).
 */
export function WhatsAppSentBadge({
  charge,
  size = "default",
}: {
  charge: ChargeView;
  size?: "default" | "sm";
}) {
  if (!charge.lastMessageSentAt || charge.lastMessageStatus === "failed") return null;

  const date = parseISO(charge.lastMessageSentAt);
  const isToday = format(date, "yyyy-MM-dd") === dateInSpace();
  const timeStr = format(date, "HH:mm");
  const triggerLabel = charge.lastMessageTrigger ? (TRIGGER_LABELS[charge.lastMessageTrigger] ?? "Cobrança") : "Cobrança";
  const statusLabel = charge.lastMessageStatus ? (STATUS_LABELS[charge.lastMessageStatus] ?? charge.lastMessageStatus) : "Enviada";

  const title = `${triggerLabel} enviado via WhatsApp em ${format(date, "dd/MM/yyyy 'às' HH:mm")} · Situação: ${statusLabel}`;

  return (
    <span
      className={cn(
        WHATSAPP_BADGE_CLASS,
        size === "sm" ? "px-1.5 py-0.5 text-[9px] leading-none" : "px-2 py-0.5 text-[10px] leading-none",
      )}
      title={title}
    >
      <MessageCircle
        className={cn(
          size === "sm" ? "size-2.5" : "size-3",
          "shrink-0 text-emerald-600 dark:text-emerald-400",
        )}
        aria-hidden
      />
      <span>WhatsApp {isToday ? timeStr : format(date, "dd/MM")}</span>
    </span>
  );
}

/**
 * Quadro do pagamento online (selo "Pago online" e o (i) da linha): quando
 * pagou, valores, liberacao para saque e comprovante. `children` e o gatilho.
 */
export function OnlineSettlementPopover({ charge, children }: { charge: ChargeView; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      {/* Fundo escurecido e desfocado, como nos dialogos: o foco fica no quadro.
          Clicar ou tocar fora fecha (so este quadro; dialogos seguem como estao). */}
      {open
        ? createPortal(
            <div
              aria-hidden
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm duration-200 animate-in fade-in-0"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
              }}
              onClick={(event) => event.stopPropagation()}
            />,
            document.body,
          )
        : null}
      <PopoverContent align="end" className="w-80 text-xs" onClick={(event) => event.stopPropagation()}>
        <OnlineSettlement charge={charge} />
      </PopoverContent>
    </Popover>
  );
}

/** "22/10/2026 às 14:32", no fuso de quem olha. */
const dateTimeLabel = (iso: string) => format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm");

const USED_METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  boleto: "boleto",
  creditCard: "cartão de crédito",
  debitCard: "cartão de débito",
};

/** Acerto do pagamento online: so busca quando o popup abre. */
function OnlineSettlement({ charge }: { charge: ChargeView }) {
  const { data, isPending } = useOnlineCheckout(charge.id);
  const paid = data?.payments.find((p) => p.status === "paid");
  if (isPending) return <p className="text-muted-foreground">Carregando...</p>;
  if (!paid) return <p className="text-muted-foreground">Sem o registro do pagamento online desta cobrança.</p>;

  const asaasFee = paid.gatewayFeeCents ?? 0;
  const split = paid.splitAmountCents ?? 0;
  const net = paid.netAmountCents ?? paid.amountCents - asaasFee - split;
  const used = paid.paidMethod
    ? USED_METHOD_LABEL[paid.paidMethod]
    : paid.method === "pix"
      ? "Pix"
      : undefined;
  const row = "flex items-center justify-between gap-3";
  const today = todayISO();
  const release = paid.fundsReleased
    ? paid.creditDate
      ? `Disponível para saque desde ${formatDate(paid.creditDate)}`
      : "Disponível para saque"
    : paid.creditDate
      ? paid.creditDate <= today
        ? `Liberação prevista para ${formatDate(paid.creditDate)}`
        : `Disponível para saque em ${formatDate(paid.creditDate)}`
      : "Liberação para saque: aguardando o Asaas";
  return (
    <div className="space-y-2.5">
      <p className="text-sm font-medium text-foreground">Pagamento online</p>
      <div className="space-y-1">
        {paid.paidAt ? (
          <div className={row}>
            <span className="text-muted-foreground">Pago em</span>
            <span className="font-medium text-foreground">{dateTimeLabel(paid.paidAt)}</span>
          </div>
        ) : null}
        {paid.openedAt ? (
          <div className={row}>
            <span className="text-muted-foreground">Aluno abriu o link em</span>
            <span className="text-foreground">{dateTimeLabel(paid.openedAt)}</span>
          </div>
        ) : null}
        <div className={row}>
          <span className="text-muted-foreground">Cobrança gerada em</span>
          <span className="text-foreground">{dateTimeLabel(paid.createdAt)}</span>
        </div>
      </div>
      <div className="space-y-1.5 border-t border-border/50 pt-2">
        <div className={row}>
          <span className="text-muted-foreground">Aluno pagou{used ? ` (${used})` : ""}</span>
          <span className="font-medium text-foreground">{formatCents(paid.amountCents)}</span>
        </div>
        <div className={row}>
          <span className="text-muted-foreground">Tarifa do Asaas</span>
          <span className="text-foreground">{asaasFee > 0 ? `- ${formatCents(asaasFee)}` : "—"}</span>
        </div>
        <div className={row}>
          <span className="text-muted-foreground">Taxa GestaraHub</span>
          <span className="text-foreground">- {formatCents(split)}</span>
        </div>
        <div className={cn(row, "border-t border-border/50 pt-1.5 font-semibold")}>
          <span className="text-foreground">Entrou na sua conta</span>
          <span className="text-emerald-600 dark:text-emerald-400">{formatCents(net)}</span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {paid.feePassedToCustomer
          ? `Taxas repassadas: o aluno pagou o valor da cobrança (${formatCents(charge.amountCents)}) mais as taxas.`
          : "Taxas absorvidas: saíram do valor da cobrança."}
        {asaasFee > 0 && !paid.paidMethod && paid.method !== "pix" ? " Tarifa estimada; o Asaas não informou o meio usado." : ""}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2">
        <span className={cn(paid.fundsReleased ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
          {release}
        </span>
        {paid.receiptUrl ? (
          <a
            href={paid.receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            Ver comprovante
          </a>
        ) : null}
      </div>
      <p className="text-[11px] text-muted-foreground">Pago online não se desfaz: seria um estorno.</p>
    </div>
  );
}

/** Selo de bolsa: "Bolsista" (integral) ou "Bolsa 50%" (parcial). */
export function ScholarshipBadge({ charge }: { charge: ChargeView }) {
  // Isento so existe por bolsa integral (dados antigos podem nao ter a %).
  const percent = charge.scholarshipPercent ?? (charge.status === "waived" ? 100 : undefined);
  if (percent === undefined || charge.status === "canceled") return null;
  const full = percent >= 100;
  return (
    <span
      title={
        charge.listAmountCents !== undefined
          ? `Valor do plano: ${formatCents(charge.listAmountCents)}`
          : undefined
      }
      // Neutro (10/11/2026): informacao, como o selo do WhatsApp.
      className="inline-flex shrink-0 items-center rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] leading-none font-medium text-muted-foreground"
    >
      {full ? "Bolsista" : `Bolsa ${percent}%`}
    </span>
  );
}

/** Valor da cobranca; com bolsa, mostra antes o valor cheio riscado. */
export function ChargeAmount({ charge, className }: { charge: ChargeView; className: string }) {
  const showList =
    charge.status !== "canceled" &&
    charge.listAmountCents !== undefined &&
    charge.listAmountCents > charge.amountCents;
  return (
    <span className="inline-flex items-baseline gap-1.5">
      {showList ? (
        <span className="text-[11px] tabular-nums text-muted-foreground line-through">
          {formatCents(charge.listAmountCents ?? 0)}
        </span>
      ) : null}
      <span
        className={cn(
          className,
          charge.status === "canceled" ? "text-muted-foreground/60 line-through" : "text-foreground",
        )}
      >
        {formatCents(charge.amountCents)}
      </span>
    </span>
  );
}

/** Aviso: aluno com Pix Automatico ativo, mas a cobranca passa do limite. */
export function RecurringLimitBadge({ limitCents }: { limitCents?: number }) {
  if (limitCents === undefined) return null;
  return (
    <span
      title={`O Pix Automático deste aluno tem limite de ${formatCents(limitCents)} por cobrança. Esta fica em aberto: cobre de outra forma ou aumente o limite no cadastro do aluno.`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] leading-none font-medium text-warning"
    >
      <AlertCircle className="size-3" aria-hidden />
      Acima do limite do Pix Automático
    </span>
  );
}

/** Periodo de uso que a cobranca paga, quando conhecido ("01/10 a 31/10"). */
export function referenceLabel(c: ChargeView): string | null {
  return c.periodStart && c.periodEnd ? `${shortDate(c.periodStart)} a ${shortDate(c.periodEnd)}` : null;
}

/** Avulsa, curso e pacote: cobrancas sem plano, que podem vir em parcelas. */
export const isInstallmentKind = (c: Pick<ChargeView, "kind">) =>
  c.kind === "extra" || c.kind === "course" || c.kind === "package" || c.kind === "event";

/** "parcela 2 de 3" da cobranca avulsa, do curso ou do pacote parcelado. */
export function installmentLabel(c: ChargeView): string | null {
  return isInstallmentKind(c) && (c.cycleTotal ?? 1) > 1 ? `parcela ${c.cycleIndex ?? 1} de ${c.cycleTotal}` : null;
}

/** O que esta sendo cobrado: a descricao da avulsa, "Curso {turma}" ou "Pacote {nome}". */
export function chargeSubject(c: ChargeView): string {
  if (c.kind === "course") return withKind("Curso", c.description ?? c.className ?? "");
  if (c.kind === "package") return withKind("Pacote", c.description ?? "");
  return c.description ?? "Cobrança avulsa";
}

export function getCycleTitle(c: ChargeView): string {
  if (isInstallmentKind(c)) {
    const installment = installmentLabel(c);
    return installment ? `${chargeSubject(c)}, ${installment}` : chargeSubject(c);
  }
  if (c.isProrated) {
    return c.proratedDays ? `Proporcional (${c.proratedDays} dias)` : "Proporcional";
  }
  const ref = referenceLabel(c);
  if (ref && c.planPeriod && c.planPeriod !== "monthly") return ref;
  if ((c.cycleTotal ?? 1) > 1) {
    return `Parcela ${c.cycleIndex ?? 1}/${c.cycleTotal}`;
  }
  return "Mensalidade";
}

/** Sugestoes do motivo de cancelamento; o campo aceita qualquer texto. */
export const CANCEL_REASON_SUGGESTIONS = ["Plano errado", "Cobrança duplicada", "Aluno desistiu"];
/** Avulsa, curso e pacote nao tem plano: "Lançada por engano" no lugar de "Plano errado". */
export const EXTRA_CANCEL_REASON_SUGGESTIONS = ["Lançada por engano", "Cobrança duplicada", "Aluno desistiu"];

/** Motivo exibido na linha cancelada: o informado pelo usuario ou a nota do sistema. */
export function cancelReasonOf(c: ChargeView): string | undefined {
  if (c.status !== "canceled") return undefined;
  if (c.cancelReason) return c.cancelReason;
  if (c.canceledBy === "system") {
    return c.notes ?? (c.kind === "dropin" ? "Saiu da aula" : undefined);
  }
  return undefined;
}

export const KIND_FILTER_LABEL: Record<"all" | ChargeKind, string> = {
  all: "Todos os tipos",
  membership: "Mensalidades",
  dropin: "Aulas avulsas",
  extra: "Cobranças avulsas",
  course: "Cursos",
  package: "Pacotes",
  event: "Eventos",
};

/** Filtro de situacao da lista: "open" (A receber), status individuais, "other" (Isentas e encerradas) e "replaced". */
export type StatusFilterValue = "open" | "all" | ChargeStatus | "other" | "replaced";

export const STATUS_FILTERS: { value: StatusFilterValue; label: string }[] = [
  { value: "open", label: "A receber" },
  { value: "all", label: "Todos os status" },
  { value: "pending", label: "Pendentes" },
  { value: "overdue", label: "Atrasadas" },
  { value: "paid", label: "Pagas" },
  { value: "other", label: "Isentas e encerradas" },
  { value: "canceled", label: "Canceladas e encerradas" },
  { value: "waived", label: "Isentas" },
  { value: "replaced", label: "Substituídas" },
];

export function isStatusFilterValue(value: string | null): value is Exclude<StatusFilterValue, "open"> {
  return (
    value === "all" ||
    value === "pending" ||
    value === "overdue" ||
    value === "paid" ||
    value === "canceled" ||
    value === "waived" ||
    value === "other" ||
    value === "replaced"
  );
}

/** A cobranca entra no filtro? "open" mostra so pendentes/atrasadas; "all" esconde as substituidas. */
export function matchesStatusFilter(c: ChargeView, filter: StatusFilterValue): boolean {
  if (filter === "replaced") return isReplaced(c);
  if (isReplaced(c)) return false;
  if (filter === "open") return c.status === "overdue" || c.status === "pending";
  if (filter === "other") return c.status === "waived" || c.status === "canceled";
  return filter === "all" || c.status === filter;
}

export function isChargeKind(value: string | null): value is ChargeKind {
  return (
    value === "membership" ||
    value === "dropin" ||
    value === "extra" ||
    value === "course" ||
    value === "package"
  );
}

/** Selo de situacao da cobranca (com "Substituída" para as trocadas e "Encerrado" para sistema). */
export function ChargeStatusBadge({ charge, size = "md" }: { charge: ChargeView; size?: "sm" | "md" }) {
  return (
    <span
      title={isSystemCanceled(charge) && !isReplaced(charge) ? SYSTEM_CANCELED_HINT : undefined}
      className={cn(
        "status-dot inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-medium leading-none",
        size === "sm" ? "text-[10px]" : "text-[11px]",
        statusClassOf(charge),
      )}
    >
      {statusLabelOf(charge)}
    </span>
  );
}

/**
 * "venceu" para a cobranca atrasada ou com a data ja passada; "vence" para a que
 * ainda vai vencer (hoje inclusive).
 */
export function dueVerb(dueDate: string, status?: ChargeView["status"]): "vence" | "venceu" {
  return status === "overdue" || dueDate < todayISO() ? "venceu" : "vence";
}

/**
 * Linha de detalhes da cobranca (texto pequeno): o que e cobrado, turma, plano,
 * vencimento, periodo, motivo do cancelamento e forma de pagamento. Sem
 * `showSubject`, o titulo da linha ja diz o que e cobrado.
 */
export function ChargeDetails({ charge: c, showSubject = true }: { charge: ChargeView; showSubject?: boolean }) {
  const parts: string[] = [];
  if (showSubject && isInstallmentKind(c)) parts.push(chargeSubject(c));
  const installment = installmentLabel(c);
  if (installment) parts.push(installment);
  // Curso ja diz a turma no "Curso {turma}".
  if (c.className && c.kind !== "course") parts.push(c.className);
  if (c.planName) parts.push(c.planName);
  if (c.planPeriod && c.planPeriod !== "monthly") parts.push(`cobrança por ${PERIOD_UNIT[c.planPeriod]}`);
  parts.push(c.kind === "dropin" ? `aula em ${dueDateLabel(c.dueDate)}` : `${dueVerb(c.dueDate, c.status)} ${dueDateLabel(c.dueDate)}`);
  const ref = referenceLabel(c);
  if (c.kind === "membership" && ref) parts.push(`referente a ${ref}`);
  const reason = cancelReasonOf(c);
  if (reason) parts.push(reason);
  // Paga: quando e como; com comprovante, avisa (abre pelo menu da linha).
  if (c.status === "paid") {
    const when = c.paidAt ? ` em ${dueDateLabel(dateInSpace(c.paidAt))}` : "";
    const how = c.method ? ` via ${paymentMethodLabel(c.method)}` : "";
    parts.push(`${c.paidVia === "online" ? "pago online" : "pago"}${how}${when}`);
    const receipts = c.attachments?.length ?? 0;
    if (receipts > 0) parts.push(receipts === 1 ? "com comprovante" : `${receipts} comprovantes`);
  }
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
      {parts.map((part, i) => (
        <span key={i} className="inline-flex items-center gap-x-2.5">
          {i > 0 ? <span aria-hidden>·</span> : null}
          <span>{part}</span>
        </span>
      ))}
    </div>
  );
}

/** "10/2026" da competencia `YYYY-MM`. */
export const competenceLabel = (competence: string) => competence.split("-").reverse().join("/");

/**
 * Titulo da cobranca no extrato do aluno (o aluno ja esta na pagina): o que e
 * cobrado. Mensalidade leva a competencia; parcelas, "2 de 3".
 */
export function statementTitle(c: ChargeView): string {
  // A turma vem na linha de detalhes.
  if (c.kind === "dropin") return "Aula avulsa";
  if (isInstallmentKind(c)) return chargeSubject(c);
  return `Mensalidade ${competenceLabel(c.competence ?? c.dueDate.slice(0, 7))}`;
}
