import { QRCodeSVG } from "qrcode.react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PublicTicketView } from "@gestarahub/contracts";
import { cn } from "@/lib/utils";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "A1B2C3D4E5F6" vira "A1B2-C3D4-E5F6" (para ler e digitar na porta). */
export function ticketCodeLabel(code: string): string {
  return code.match(/.{1,4}/g)?.join("-") ?? code;
}

const STATE_LABEL: Record<PublicTicketView["state"], { text: string; tone: string }> = {
  confirmed: { text: "Confirmado", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  payment_pending: { text: "Pagamento pendente", tone: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  reserved: { text: "Aguardando pagamento", tone: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  waitlist: { text: "Lista de espera", tone: "border-border bg-muted text-muted-foreground" },
  canceled: { text: "Inscrição cancelada", tone: "border-destructive/30 bg-destructive/10 text-destructive" },
};

/**
 * O ingresso (doc product/29 T2): espaco, evento, dias, local, quem conduz,
 * nome mascarado, situacao e o QR com o codigo escrito embaixo.
 */
export function TicketCard({ ticket, url }: { ticket: PublicTicketView; url: string }) {
  const state = STATE_LABEL[ticket.state];
  const valid = ticket.state === "confirmed" || ticket.state === "payment_pending";
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
      <div className="space-y-1 border-b border-dashed p-5">
        <p className="text-xs font-medium text-muted-foreground">{ticket.organizationName}</p>
        <h1 className="min-w-0 break-words text-lg font-semibold text-foreground">{ticket.eventName}</h1>
        <p className="text-sm text-foreground">{ticket.holderName}</p>
        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", state.tone)}>{state.text}</span>
      </div>
      <div className="space-y-1.5 p-5 text-sm text-foreground">
        {ticket.days.map((d) => (
          <p key={`${d.date}${d.start}`}>
            {capitalize(format(parseISO(d.date), "EEE, dd/MM", { locale: ptBR }))} · {d.start} às {d.end}
          </p>
        ))}
        {ticket.address ? <p className="min-w-0 break-words text-muted-foreground">{ticket.address}</p> : null}
        {ticket.instructors.length > 0 ? <p className="min-w-0 break-words text-muted-foreground">{ticket.instructors.join(", ")}</p> : null}
      </div>
      {valid ? (
        <div className="flex flex-col items-center gap-2 border-t border-dashed p-5">
          <div className="w-48 rounded-lg bg-white p-3">
            <QRCodeSVG value={url} level="M" marginSize={0} className="h-auto w-full" role="img" aria-label="QR code do ingresso" />
          </div>
          <p className="font-mono text-sm tracking-wider text-foreground">{ticketCodeLabel(ticket.code)}</p>
          <p className="text-xs text-muted-foreground">Mostre na entrada</p>
        </div>
      ) : null}
    </div>
  );
}
