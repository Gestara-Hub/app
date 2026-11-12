"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Hourglass, Ticket } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ApiErrorField, PublicEventSignupResult, PublicEventView } from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { RequiredMark } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EVENT_SIGNUP_TERMS } from "@/lib/event-signup-terms";
import { cn } from "@/lib/utils";
import { submitEventSignupAction } from "./actions";

const INPUT = "text-base md:text-sm";

function FieldError({ fields, name }: { fields: ApiErrorField[]; name: string }) {
  const message = fields.find((f) => f.field === name)?.message;
  return message ? (
    <p id={`${name}-error`} className="text-xs text-destructive">
      {message}
    </p>
  ) : null;
}

/**
 * Formulario da inscricao pelo link: nome e WhatsApp (ou o responsavel, no
 * menor), dias no evento por dia, aceite obrigatorio e WhatsApp opcional.
 * Nada vem preenchido (regra das paginas publicas).
 */
export function EventSignupForm({ event }: { event: PublicEventView }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isMinor, setIsMinor] = useState(false);
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [allDays, setAllDays] = useState(true);
  const [days, setDays] = useState<string[]>([]);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptWhatsapp, setAcceptWhatsapp] = useState(false);
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);
  const [fields, setFields] = useState<ApiErrorField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicEventSignupResult | null>(null);

  const perDay = event.billingMode === "per_day";
  const chosenDays = perDay && !allDays ? days : event.sessions.map((s) => s.id);
  const amount = event.billingMode === "free" ? 0 : perDay ? (event.dayPriceCents ?? 0) * chosenDays.length : event.priceCents;

  if (result) return <SignupResult result={result} event={event} />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (perDay && !allDays && days.length === 0) {
      setFields([{ field: "sessionIds", message: "Escolha ao menos um dia." }]);
      return;
    }
    setPending(true);
    setError(null);
    setFields([]);
    const response = await submitEventSignupAction({
      code: event.code,
      name,
      phone: isMinor ? guardianPhone : phone,
      ...(email.trim() ? { email } : {}),
      isMinor,
      ...(isMinor ? { guardianName, guardianPhone } : {}),
      scope: perDay && !allDays ? "days" : "full",
      ...(perDay && !allDays ? { sessionIds: days } : {}),
      acceptTerms,
      acceptWhatsapp,
      website,
    });
    setPending(false);
    if (response.ok) {
      setResult(response.result);
      return;
    }
    setError(response.error);
    setFields(response.fields ?? []);
  };

  const describedBy = (name: string) => (fields.some((f) => f.field === name) ? `${name}-error` : undefined);

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4 border-t pt-4">
      <h2 className="text-base font-semibold text-foreground">Inscrição</h2>

      <div className="space-y-1.5">
        <Label htmlFor="signup-name">
          <span>
            {isMinor ? "Nome do participante" : "Nome"}
            <RequiredMark />
          </span>
        </Label>
        <Input
          id="signup-name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          className={INPUT}
          aria-invalid={Boolean(describedBy("name"))}
          aria-describedby={describedBy("name")}
        />
        <FieldError fields={fields} name="name" />
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <Checkbox checked={isMinor} onCheckedChange={(v) => setIsMinor(v === true)} />
        É menor de 18 anos
      </label>

      {isMinor ? (
        <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="signup-guardian-name">
              <span>
                Nome do responsável
                <RequiredMark />
              </span>
            </Label>
            <Input
              id="signup-guardian-name"
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              maxLength={120}
              className={INPUT}
              aria-invalid={Boolean(describedBy("guardianName"))}
              aria-describedby={describedBy("guardianName")}
            />
            <FieldError fields={fields} name="guardianName" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signup-guardian-phone">
              <span>
                WhatsApp do responsável
                <RequiredMark />
              </span>
            </Label>
            <Input
              id="signup-guardian-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 90000-0000"
              value={guardianPhone}
              onChange={(e) => setGuardianPhone(e.target.value)}
              maxLength={20}
              className={INPUT}
              aria-invalid={Boolean(describedBy("guardianPhone") || describedBy("phone"))}
              aria-describedby={describedBy("guardianPhone") ?? describedBy("phone")}
            />
            <FieldError fields={fields} name="guardianPhone" />
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="signup-phone">
            <span>
              WhatsApp
              <RequiredMark />
            </span>
          </Label>
          <Input
            id="signup-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 90000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={20}
            className={INPUT}
            aria-invalid={Boolean(describedBy("phone"))}
            aria-describedby={describedBy("phone")}
          />
          <FieldError fields={fields} name="phone" />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="signup-email">E-mail</Label>
        <Input
          id="signup-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Opcional"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={160}
          className={INPUT}
        />
        <FieldError fields={fields} name="email" />
      </div>

      {perDay && event.sessions.length > 1 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">Dias</legend>
          <div className="flex gap-2">
            {[
              { value: true, label: "Todos os dias" },
              { value: false, label: "Só alguns dias" },
            ].map((option) => (
              <Button
                key={String(option.value)}
                type="button"
                variant={allDays === option.value ? "default" : "outline"}
                aria-pressed={allDays === option.value}
                onClick={() => setAllDays(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          {!allDays ? (
            <div className="space-y-1.5">
              {event.sessions.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    checked={days.includes(s.id)}
                    onCheckedChange={(v) => setDays((prev) => (v === true ? [...prev, s.id] : prev.filter((id) => id !== s.id)))}
                  />
                  {format(parseISO(s.date), "EEE, dd/MM", { locale: ptBR })} · {s.start} às {s.end}
                </label>
              ))}
              <FieldError fields={fields} name="sessionIds" />
            </div>
          ) : null}
        </fieldset>
      ) : null}

      {/* Campo-armadilha: escondido de quem usa a pagina; robo preenche. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Site
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      <div className="space-y-2.5">
        <label className="flex items-start gap-2 text-sm text-foreground">
          <Checkbox className="mt-0.5" checked={acceptTerms} onCheckedChange={(v) => setAcceptTerms(v === true)} />
          <span>
            {isMinor ? EVENT_SIGNUP_TERMS.guardianText : EVENT_SIGNUP_TERMS.text}{" "}
            <Link href="/privacy" target="_blank" className="underline underline-offset-2">
              Ler a Política
            </Link>
            <RequiredMark />
          </span>
        </label>
        <FieldError fields={fields} name="acceptTerms" />
        <label className="flex items-start gap-2 text-sm text-foreground">
          <Checkbox className="mt-0.5" checked={acceptWhatsapp} onCheckedChange={(v) => setAcceptWhatsapp(v === true)} />
          <span>{EVENT_SIGNUP_TERMS.whatsapp}</span>
        </label>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending
          ? "Enviando..."
          : event.isFull
            ? "Entrar na lista de espera"
            : amount > 0
              ? `Inscrever (${formatCents(amount)})`
              : "Inscrever"}
      </Button>
      {amount > 0 && !event.isFull && event.seatGuarantee === "on_payment" ? (
        <p className="text-center text-xs text-muted-foreground">
          A vaga fica reservada por {event.holdMinutes} minutos até o pagamento.
        </p>
      ) : null}
    </form>
  );
}

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

function SignupResult({ result, event }: { result: PublicEventSignupResult; event: PublicEventView }) {
  const countdown = useCountdown(result.status === "reserved" ? result.holdUntil : undefined);
  const payHref = result.chargeId && event.onlinePayments ? `/p/c/${result.chargeId}` : null;
  const ticketHref = result.ticketCode ? `/p/i/${result.ticketCode}` : null;

  const box = (icon: React.ReactNode, title: string, text: string, tone: "ok" | "wait" = "ok") => (
    <div className="space-y-3 border-t pt-4 text-center">
      <div
        className={cn(
          "mx-auto flex size-12 items-center justify-center rounded-full",
          tone === "ok" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600",
        )}
      >
        {icon}
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );

  if (result.status === "already") {
    return box(<CheckCircle2 className="size-6" />, "Você já está inscrito", "Este telefone já tem inscrição neste evento. Se perdeu o ingresso, peça ao espaço.");
  }
  if (result.status === "waitlist") {
    return box(<Hourglass className="size-6" />, "Você está na lista de espera", "O evento lotou. O espaço avisa se abrir vaga.", "wait");
  }
  if (result.status === "reserved") {
    return (
      <div className="space-y-4">
        {box(
          <Clock className="size-6" />,
          `Vaga reservada para ${result.displayName}`,
          `Pague ${formatCents(result.amountCents)} em até ${countdown ?? ""} para garantir a vaga. Depois disso, a reserva cai.`,
          "wait",
        )}
        {payHref ? (
          <Button asChild className="w-full">
            <a href={payHref}>Pagar agora</a>
          </Button>
        ) : null}
        <p className="text-center text-xs text-muted-foreground">O ingresso chega assim que o pagamento cair.</p>
      </div>
    );
  }
  const pending = result.amountCents > 0;
  return (
    <div className="space-y-4">
      {box(
        <CheckCircle2 className="size-6" />,
        `Inscrição confirmada, ${result.displayName}`,
        pending
          ? `A vaga é sua. Falta pagar ${formatCents(result.amountCents)}${payHref ? "." : ": combine o pagamento com o espaço."}`
          : "A vaga é sua. Mostre o ingresso na entrada.",
      )}
      {payHref && pending ? (
        <Button asChild className="w-full">
          <a href={payHref}>Pagar agora</a>
        </Button>
      ) : null}
      {ticketHref ? (
        <Button asChild variant={payHref && pending ? "outline" : "default"} className="w-full">
          <a href={ticketHref}>
            <Ticket className="size-4" />
            Ver ingresso
          </a>
        </Button>
      ) : null}
    </div>
  );
}
