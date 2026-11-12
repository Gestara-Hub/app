import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, MapPin, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCents } from "@gestarahub/core/format";
import type { PublicEventView } from "@gestarahub/contracts";
import logoLightImage from "@/assets/logo-light.svg";
import logoDarkImage from "@/assets/logo-dark.svg";
import { PublicLegalFooter } from "@/components/shared/public-legal-footer";
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
    <div className="flex min-h-screen flex-col items-center bg-muted/20 px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Image src={logoLightImage} alt="GestaraHub" className="h-9 w-auto dark:hidden" priority />
          <Image src={logoDarkImage} alt="GestaraHub" className="hidden h-9 w-auto dark:block" priority />
        </div>

        <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-lg">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">{event.organizationName}</p>
            <h1 className="min-w-0 break-words text-xl font-semibold text-foreground">{event.eventName}</h1>
            {event.modalityName ? <p className="text-sm text-muted-foreground">{event.modalityName}</p> : null}
          </div>

          <ul className="space-y-2 text-sm text-foreground">
            {event.sessions.map((s) => (
              <li key={s.id} className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>
                  {dayLine(s.date)} · {s.start} às {s.end}
                </span>
              </li>
            ))}
            {instructors ? (
              <li className="flex items-start gap-2">
                <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 break-words">{instructors}</span>
              </li>
            ) : null}
            {event.address ? (
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 break-words">{event.address}</span>
              </li>
            ) : null}
          </ul>

          {event.description ? <p className="min-w-0 break-words text-sm text-foreground/80">{event.description}</p> : null}

          <div className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-4">
            <p className="text-lg font-semibold text-foreground">{priceLine(event)}</p>
            {event.earlyBird ? (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Lote até {format(parseISO(event.earlyBird.until), "dd/MM")}
              </p>
            ) : null}
            {event.isFull ? (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Lotado: entre na lista de espera</p>
            ) : event.spotsLeft ? (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                {event.spotsLeft === 1 ? "Última vaga" : `Últimas ${event.spotsLeft} vagas`}
              </p>
            ) : null}
          </div>

          {event.open ? (
            <EventSignupForm event={event} />
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>{CLOSED_TEXT[event.closedReason ?? "disabled"]}</p>
            </div>
          )}
        </div>

        <PublicLegalFooter />
      </div>
    </div>
  );
}
