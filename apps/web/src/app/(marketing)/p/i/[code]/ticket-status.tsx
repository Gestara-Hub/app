"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
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

/**
 * Topo da pagina da inscricao (12/11/2026): a pessoa chega aqui logo depois de
 * se inscrever e o endereco fica, entao atualizar a pagina nao perde o
 * ingresso. Mostra o que falta (pagar, prazo da reserva) e o "Pagar agora".
 */
export function TicketStatus({ ticket, isNew, emailSent }: { ticket: PublicTicketView; isNew: boolean; emailSent: boolean }) {
  const router = useRouter();
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
  let tone: "ok" | "wait" | "off" = "ok";
  let title: string | null = null;
  let text: string | null = null;
  if (ticket.reservationExpired) {
    tone = "off";
    title = "A reserva venceu";
    text = "O prazo para pagar acabou e a vaga voltou para o evento. Se ainda houver vaga, faça a inscrição de novo.";
  } else if (ticket.state === "reserved") {
    tone = "wait";
    title = `Vaga reservada, ${ticket.holderName}`;
    text = `Pague ${formatCents(pending)} em até ${countdown ?? ""} para garantir a vaga.${isNew ? ` ${keepLink}` : ""}`;
  } else if (ticket.state === "payment_pending") {
    title = isNew ? `Inscrição confirmada, ${ticket.holderName}` : null;
    text = `A vaga é sua. Falta pagar ${formatCents(pending)}${ticket.payChargeId ? "." : ": combine o pagamento com o espaço."}${isNew ? ` ${keepLink}` : ""}`;
  } else if (ticket.state === "confirmed" && isNew) {
    title = `Inscrição confirmada, ${ticket.holderName}`;
    text = `A vaga é sua. ${keepLink}`;
  }
  if (!title && !text) return null;

  const Icon = tone === "ok" ? CheckCircle2 : tone === "wait" ? Clock : XCircle;
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
      {title ? (
        <div
          className={cn(
            "mx-auto flex size-11 items-center justify-center rounded-full",
            tone === "ok" && "bg-emerald-500/10 text-emerald-600",
            tone === "wait" && "bg-amber-500/10 text-amber-600",
            tone === "off" && "bg-destructive/10 text-destructive",
          )}
        >
          <Icon className="size-6" />
        </div>
      ) : null}
      <div className="space-y-1">
        {title ? <h2 className="min-w-0 break-words text-base font-semibold text-foreground">{title}</h2> : null}
        {text ? <p className="text-sm text-muted-foreground">{text}</p> : null}
      </div>
      {waitingPayment && ticket.payChargeId ? (
        <Button asChild className="w-full">
          <a href={`/p/c/${ticket.payChargeId}`}>Pagar agora</a>
        </Button>
      ) : null}
      {ticket.state === "reserved" && !ticket.reservationExpired ? (
        <p className="text-xs text-muted-foreground">Pagou? O ingresso aparece aqui sozinho.</p>
      ) : null}
    </div>
  );
}
