"use client";

import { CheckCircle2, CircleAlert, Clock, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { TicketCheckResult } from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { cn } from "@/lib/utils";

type Tone = "ok" | "warn" | "bad";

/** Titulo, texto e cor de cada resposta da leitura (doc product/29 T5). */
export function ticketCheckCopy(result: TicketCheckResult): { tone: Tone; title: string; text?: string } {
  const who = result.studentName ?? "";
  switch (result.outcome) {
    case "ok":
      return { tone: "ok", title: result.entered ? "Pode entrar" : "Ingresso válido", text: who };
    case "already":
      return {
        tone: "warn",
        title: `Já entrou hoje${result.checkedInAt ? ` às ${format(parseISO(result.checkedInAt), "HH:mm")}` : ""}`,
        text: [who, result.checkedInBy ? `por ${result.checkedInBy}` : ""].filter(Boolean).join(" · "),
      };
    case "payment_pending":
      return {
        tone: "warn",
        title: result.entered ? "Entrou com pagamento pendente" : `Pagamento pendente: ${formatCents(result.pendingCents ?? 0)}`,
        text: who,
      };
    case "reserved":
      return { tone: "bad", title: "Reserva sem pagamento", text: `${who}${result.pendingCents ? ` · ${formatCents(result.pendingCents)} em aberto` : ""}` };
    case "waitlist":
      return { tone: "bad", title: "Está na lista de espera", text: who };
    case "canceled":
      return { tone: "bad", title: "Inscrição cancelada", text: who };
    case "not_this_day":
      return { tone: "bad", title: "Este dia não está na inscrição", text: who };
    case "not_today":
      return { tone: "bad", title: "O evento não é hoje", text: who };
    case "other_event":
      return { tone: "bad", title: "Ingresso de outro evento", text: result.otherEventName ?? who };
    default:
      return { tone: "bad", title: "Ingresso não encontrado" };
  }
}

const TONE = {
  ok: { box: "border-emerald-500/40 bg-emerald-500/10", icon: "text-emerald-600 dark:text-emerald-400", Icon: CheckCircle2 },
  warn: { box: "border-amber-500/40 bg-amber-500/10", icon: "text-amber-600 dark:text-amber-400", Icon: CircleAlert },
  bad: { box: "border-destructive/40 bg-destructive/10", icon: "text-destructive", Icon: XCircle },
};

/** O resultado grande da leitura, para ler de longe na porta. */
export function TicketCheckResultView({ result, className }: { result: TicketCheckResult; className?: string }) {
  const copy = ticketCheckCopy(result);
  const tone = TONE[copy.tone];
  const Icon = result.outcome === "already" ? Clock : tone.Icon;
  return (
    <div role="status" className={cn("flex items-center gap-3 rounded-xl border p-4", tone.box, className)}>
      <Icon className={cn("size-8 shrink-0", tone.icon)} aria-hidden />
      <div className="min-w-0">
        <p className="text-lg font-semibold text-foreground">{copy.title}</p>
        {copy.text ? <p className="min-w-0 break-words text-sm text-foreground/80">{copy.text}</p> : null}
      </div>
    </div>
  );
}
