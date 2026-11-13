import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AlignLeft, CalendarDays, Clock, MapPin, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCents } from "@gestarahub/core/format";
import type { PublicEventView } from "@gestarahub/contracts";
import logoLightImage from "@/assets/logo-light.svg";
import logoDarkImage from "@/assets/logo-dark.svg";
import { PublicLegalFooter } from "@/components/shared/public-legal-footer";
import { Perforation, TicketDetail, TicketHeader, TicketLabel, TicketSheet } from "../../_components/ticket-parts";
import { loadPublicEvent } from "@/services/server/eventPublicSignup";
import { EventSignupForm } from "./event-signup-form";

/**
 * Inscricao em evento por link (doc product/29, aprovada em 12/11/2026):
 * publica, sem login. Mostra o evento e nenhum dado de aluno; o formulario
 * so cria (visitante novo e a inscricao), nunca muda um cadastro.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

function dayLine(date: string): string {
  const text = format(parseISO(date), "EEEE, d 'de' MMMM", { locale: ptBR });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const event = await loadPublicEvent(code);
  if (!event) return { title: "Inscrição | GestaraHub", robots: { index: false, follow: false } };
  const first = event.sessions[0];
  const when = first ? format(parseISO(first.date), "d 'de' MMMM", { locale: ptBR }) : "";
  return {
    title: `${event.eventName} · ${event.organizationName}`,
    description: `Inscrições para ${event.eventName}${when ? `, ${when}` : ""}. ${event.organizationName}.`,
    robots: { index: false, follow: false },
    openGraph: {
      title: `${event.eventName} · ${event.organizationName}`,
      description: when ? `Inscrições abertas · ${when}` : "Inscrições abertas",
    },
  };
}

function priceLine(event: PublicEventView): string {
  if (event.billingMode === "free") return "Sem custo";
  if (event.billingMode === "per_day") return `${formatCents(event.dayPriceCents ?? 0)} por dia`;
  return formatCents(event.priceCents);
}

const CLOSED_TEXT: Record<NonNullable<PublicEventView["closedReason"]>, string> = {
  disabled: "As inscrições por este link estão fechadas. Fale com o espaço.",
  plan: "As inscrições por este link estão fechadas. Fale com o espaço.",
  until: "O prazo das inscrições terminou.",
  finished: "Este evento já aconteceu.",
  canceled: "Este evento foi cancelado.",
};

export default async function EventSignupPage({ params }: Props) {
  const { code } = await params;
  const event = await loadPublicEvent(code);
  if (!event) notFound();

  const instructors = event.instructors.map((i) => (i.isGuest && i.origin ? `${i.name} (${i.origin})` : i.name)).join(", ");

  return (
    // Fundo solido: e a cor dos recortes do picote (mesmo visual do ingresso).
    <div className="flex min-h-screen flex-col items-center bg-muted px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Image src={logoLightImage} alt="GestaraHub" className="h-9 w-auto dark:hidden" priority />
          <Image src={logoDarkImage} alt="GestaraHub" className="hidden h-9 w-auto dark:block" priority />
        </div>

        <TicketSheet>
          <TicketHeader organizationName={event.organizationName} eventName={event.eventName} modalityName={event.modalityName} />

          <Perforation />

          <div className="space-y-4 p-6 text-sm text-foreground">
            <TicketDetail icon={CalendarDays} label={event.sessions.length > 1 ? "Dias" : "Dia"}>
              <ul className="space-y-1">
                {event.sessions.map((s) => (
                  // Data e horario inteiros: no celular o horario desce junto, sem quebrar no meio.
                  <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span>{dayLine(s.date)}</span>
                    <span className="text-muted-foreground">
                      {s.start} às {s.end}
                    </span>
                  </li>
                ))}
              </ul>
            </TicketDetail>
            {event.address ? (
              <TicketDetail icon={MapPin} label="Local">
                <p className="min-w-0 break-words">{event.address}</p>
              </TicketDetail>
            ) : null}
            {instructors ? (
              <TicketDetail icon={User} label="Quem conduz">
                <p className="min-w-0 break-words">{instructors}</p>
              </TicketDetail>
            ) : null}
            {event.description ? (
              <TicketDetail icon={AlignLeft} label="Sobre">
                <p className="min-w-0 whitespace-pre-line break-words text-foreground/80">{event.description}</p>
              </TicketDetail>
            ) : null}
          </div>

          <div className="mx-6 flex flex-wrap items-end justify-between gap-3 border-t border-border pb-6 pt-5">
            <div className="space-y-1">
              <TicketLabel>Valor</TicketLabel>
              <p className="text-2xl font-semibold leading-none text-foreground">{priceLine(event)}</p>
              {event.earlyBird ? (
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  Lote até {format(parseISO(event.earlyBird.until), "dd/MM")}
                </p>
              ) : null}
            </div>
            {event.isFull || event.spotsLeft ? (
              <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                {event.isFull ? "Lotado: entre na lista de espera" : event.spotsLeft === 1 ? "Última vaga" : `Últimas ${event.spotsLeft} vagas`}
              </span>
            ) : null}
          </div>

          <Perforation />

          <div className="p-6">
            {event.open ? (
              <EventSignupForm event={event} />
            ) : (
              <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                <Clock className="mt-0.5 size-5 shrink-0" aria-hidden />
                <p>{CLOSED_TEXT[event.closedReason ?? "disabled"]}</p>
              </div>
            )}
          </div>
        </TicketSheet>

        <PublicLegalFooter />
      </div>
    </div>
  );
}
