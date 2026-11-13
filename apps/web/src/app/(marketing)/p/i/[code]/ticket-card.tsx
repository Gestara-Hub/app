import { QRCodeSVG } from "qrcode.react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, MapPin, QrCode, User } from "lucide-react";
import type { PublicTicketView } from "@gestarahub/contracts";
import { cn } from "@/lib/utils";
import { Perforation, TicketDetail as Detail, TicketHeader, TicketLabel as Label, TicketSheet } from "../../_components/ticket-parts";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "A1B2C3D4E5F6" vira "A1B2-C3D4-E5F6" (para ler e digitar na porta). */
export function ticketCodeLabel(code: string): string {
  return code.match(/.{1,4}/g)?.join("-") ?? code;
}

/** Situacao de cada dia no cartao: presenca, hoje ou fora da inscricao. */
function dayStatus(day: PublicTicketView["days"][number]): { text: string; tone: string } | null {
  if (!day.included) return { text: "Não incluso", tone: "text-muted-foreground" };
  if (day.attended) return { text: day.enteredAt ? `Entrou às ${day.enteredAt}` : "Presente", tone: "text-emerald-700 dark:text-emerald-400" };
  if (day.isToday) return { text: "Hoje", tone: "text-amber-700 dark:text-amber-400" };
  return null;
}

const STATE_LABEL: Record<PublicTicketView["state"], { text: string; tone: string }> = {
  confirmed: { text: "Confirmado", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  payment_pending: { text: "Pagamento pendente", tone: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  reserved: { text: "Aguardando pagamento", tone: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  waitlist: { text: "Lista de espera", tone: "border-border bg-muted text-muted-foreground" },
  canceled: { text: "Inscrição cancelada", tone: "border-destructive/30 bg-destructive/10 text-destructive" },
};

/**
 * O ingresso (doc product/29 T2): espaco, evento, nome mascarado, situacao,
 * os dias com a presenca de cada um, local, quem conduz e o QR com o codigo.
 */
export function TicketCard({ ticket, url }: { ticket: PublicTicketView; url: string }) {
  const state = STATE_LABEL[ticket.state];
  const valid = ticket.state === "confirmed" || ticket.state === "payment_pending";
  const includedDays = ticket.days.filter((d) => d.included).length;
  return (
    <TicketSheet>
      <TicketHeader organizationName={ticket.organizationName} eventName={ticket.eventName} modalityName={ticket.modalityName} />

      <Perforation />

      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-6 pt-5">
        <div className="min-w-0 space-y-1">
          <Label>Participante</Label>
          <p className="min-w-0 break-words text-base font-semibold text-foreground">{ticket.holderName}</p>
        </div>
        <div className="space-y-1 text-right">
          <Label>Situação</Label>
          <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", state.tone)}>{state.text}</span>
        </div>
      </div>

      <div className="space-y-4 p-6 pt-5 text-sm text-foreground">
        <Detail icon={CalendarDays} label={ticket.days.length > 1 ? "Dias" : "Dia"}>
          <ul className="space-y-1">
            {ticket.days.map((d) => {
              const status = dayStatus(d);
              return (
                <li
                  key={`${d.date}${d.start}`}
                  className={cn("flex flex-wrap items-baseline justify-between gap-x-3", !d.included && "text-muted-foreground")}
                >
                  <span>
                    {capitalize(format(parseISO(d.date), "EEE, dd/MM", { locale: ptBR }))} · {d.start} às {d.end}
                  </span>
                  {status ? <span className={cn("text-xs font-medium", status.tone)}>{status.text}</span> : null}
                </li>
              );
            })}
          </ul>
        </Detail>
        {ticket.address ? (
          <Detail icon={MapPin} label="Local">
            <p className="min-w-0 break-words">{ticket.address}</p>
          </Detail>
        ) : null}
        {ticket.instructors.length > 0 ? (
          <Detail icon={User} label="Quem conduz">
            <p className="min-w-0 break-words">{ticket.instructors.join(", ")}</p>
          </Detail>
        ) : null}
      </div>

      {valid ? (
        <>
          <Perforation />
          <div className="flex flex-col items-center gap-3 p-6">
            <div className="w-52 rounded-xl bg-white p-3 ring-1 ring-black/5">
              <QRCodeSVG value={url} level="M" marginSize={0} className="h-auto w-full" role="img" aria-label="QR code do ingresso" />
            </div>
            <p className="font-mono text-base font-semibold tracking-[0.2em] text-foreground">{ticketCodeLabel(ticket.code)}</p>
            <p className="max-w-xs text-center text-xs text-muted-foreground">
              {includedDays > 1 ? `Vale para os ${includedDays} dias. Mostre na entrada de cada dia.` : "Mostre na entrada"}
            </p>
          </div>
        </>
      ) : ticket.state === "reserved" && !ticket.reservationExpired ? (
        <>
          <Perforation />
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <QrCode className="size-6" aria-hidden />
            </div>
            <p className="max-w-xs text-xs text-muted-foreground">O QR code aparece aqui quando o pagamento cair.</p>
          </div>
        </>
      ) : null}
    </TicketSheet>
  );
}
