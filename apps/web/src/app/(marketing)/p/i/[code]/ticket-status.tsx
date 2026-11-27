"use client";

import { useEffect, useState } from "react";
import { useAppRouter } from "@/lib/use-app-router";
import { CheckCircle2, Clock, CreditCard, XCircle } from "lucide-react";
import type { PublicTicketView } from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Enquanto falta pagar, a pagina se atualiza sozinha (o QR aparece quando o pagamento cai). */
const REFRESH_MS = 15_000;

/** Minutos e segundos que faltam para a reserva vencer. */
function useCountdown(until?: string): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  if (!until) return null;
  const left = Math.max(0, Date.parse(until) - now);
  const minutes = Math.floor(left / 60_000);
  const seconds = Math.floor((left % 60_000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const TONE = {
  ok: { box: "border-emerald-500/30 bg-emerald-500/5", icon: "text-emerald-600 dark:text-emerald-400", Icon: CheckCircle2 },
  pay: { box: "border-amber-500/30 bg-amber-500/5", icon: "text-amber-600 dark:text-amber-400", Icon: CreditCard },
  wait: { box: "border-amber-500/30 bg-amber-500/5", icon: "text-amber-600 dark:text-amber-400", Icon: Clock },
  off: { box: "border-destructive/30 bg-destructive/5", icon: "text-destructive", Icon: XCircle },
};

/**
 * Aviso acima do ingresso (12/11/2026): o que acabou de acontecer e o que
 * falta, com o "Pagar agora". A pessoa chega aqui logo depois de se inscrever
 * e o endereco fica, entao atualizar a pagina nao perde o ingresso.
 */
export function TicketStatus({ ticket, isNew, emailSent }: { ticket: PublicTicketView; isNew: boolean; emailSent: boolean }) {
  const router = useAppRouter();
  const countdown = useCountdown(ticket.state === "reserved" ? ticket.holdUntil : undefined);
  const pending = ticket.pendingCents ?? 0;
  const waitingPayment = (ticket.state === "reserved" || ticket.state === "payment_pending") && pending > 0;

  useEffect(() => {
    if (!waitingPayment) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [waitingPayment, router]);

  const keepLink = `Guarde este endereço: ele é o seu ingresso.${emailSent ? " Também enviamos para o seu e-mail." : ""}`;
  const payElsewhere = ticket.payChargeId ? "" : " Combine o pagamento com o espaço.";
  let tone: keyof typeof TONE;
  let title: string;
  let text: string;
  if (ticket.reservationExpired) {
    tone = "off";
    title = "A reserva venceu";
    text = "O prazo para pagar acabou e a vaga voltou para o evento. Se ainda houver vaga, faça a inscrição de novo.";
  } else if (ticket.state === "reserved") {
    tone = "wait";
    title = `Vaga reservada por ${countdown ?? ""}`;
    text = `Pague ${formatCents(pending)} para garantir a vaga. O ingresso aparece aqui quando o pagamento cair.${payElsewhere}${isNew ? ` ${keepLink}` : ""}`;
  } else if (ticket.state === "payment_pending" && pending > 0) {
    tone = "pay";
    title = `Falta pagar ${formatCents(pending)}`;
    text = `${isNew ? `Inscrição confirmada, ${ticket.holderName}: a vaga é sua.` : "A vaga é sua."}${payElsewhere}${isNew ? ` ${keepLink}` : ""}`;
  } else if (ticket.state === "confirmed" && isNew) {
    tone = "ok";
    title = `Inscrição confirmada, ${ticket.holderName}`;
    text = keepLink;
  } else {
    return null;
  }

  const style = TONE[tone];
  return (
    <section className={cn("space-y-3 rounded-2xl border p-4", style.box)} aria-live="polite">
      <div className="flex gap-3">
        <style.Icon className={cn("mt-0.5 size-5 shrink-0", style.icon)} aria-hidden />
        <div className="min-w-0 space-y-0.5">
          <h2 className="min-w-0 break-words text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{text}</p>
        </div>
      </div>
      {waitingPayment && ticket.payChargeId && !ticket.reservationExpired ? (
        <Button asChild className="w-full">
          <a href={`/p/c/${ticket.payChargeId}`}>
            <CreditCard className="size-4" />
            Pagar agora
          </a>
        </Button>
      ) : null}
    </section>
  );
}
