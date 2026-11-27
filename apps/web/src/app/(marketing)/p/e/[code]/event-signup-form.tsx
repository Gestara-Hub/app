"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppRouter } from "@/lib/use-app-router";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Hourglass, Ticket } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PublicEventSignupResult, PublicEventView } from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { isPossiblePhone } from "@gestarahub/core/phone";
import { FieldShell, InputPhone, InputText, SegmentedChoiceField, SwitchField } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EVENT_SIGNUP_TERMS } from "@/lib/event-signup-terms";
import { handleFormApiError } from "@/lib/form-errors";
import { useIsClient } from "@/lib/use-is-client";
import { cn } from "@/lib/utils";
import { submitEventSignupAction } from "./actions";
import { readRememberedSignups, rememberSignup } from "./signup-memory";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mesmas regras do servidor, para o erro aparecer antes de enviar. */
const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome."),
    phone: z.string().trim(),
    email: z.string().trim().min(1, "Informe o e-mail.").refine((v) => EMAIL_RE.test(v), { message: "Informe um e-mail válido." }),
    isMinor: z.boolean(),
    guardianName: z.string().trim().optional(),
    guardianPhone: z.string().trim().optional(),
    scope: z.enum(["full", "days"]),
    sessionIds: z.array(z.string()),
    acceptTerms: z.boolean().refine((v) => v, { message: "Aceite para concluir a inscrição." }),
    acceptWhatsapp: z.boolean(),
    website: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isMinor) {
      if ((data.guardianName ?? "").length < 2) ctx.addIssue({ code: "custom", path: ["guardianName"], message: "Informe o nome do responsável." });
      if (!data.guardianPhone || !isPossiblePhone(data.guardianPhone)) {
        ctx.addIssue({ code: "custom", path: ["guardianPhone"], message: "Informe o WhatsApp do responsável com DDD." });
      }
    } else if (!data.phone || !isPossiblePhone(data.phone)) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Informe o WhatsApp com DDD." });
    }
    if (data.scope === "days" && data.sessionIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["sessionIds"], message: "Escolha ao menos um dia." });
    }
  });

type SignupValues = z.infer<typeof signupSchema>;

/**
 * Formulario da inscricao pelo link, no padrao dos formularios do sistema
 * (react-hook-form + Zod e os campos de `@/components/form`): nome e WhatsApp
 * (ou o responsavel, no menor), dias no evento por dia, aceite obrigatorio e
 * WhatsApp opcional. Nada vem preenchido (regra das paginas publicas).
 */
export function EventSignupForm({ event }: { event: PublicEventView }) {
  const router = useAppRouter();
  const [result, setResult] = useState<PublicEventSignupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Indo para a pagina do ingresso: o botao segue ocupado ate a troca de pagina.
  const [leaving, setLeaving] = useState(false);
  const isClient = useIsClient();
  const remembered = useMemo(() => (isClient ? readRememberedSignups(event.code) : []), [isClient, event.code]);
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      isMinor: false,
      guardianName: "",
      guardianPhone: "",
      scope: "full",
      sessionIds: [],
      acceptTerms: false,
      acceptWhatsapp: false,
      website: "",
    },
  });
  const isMinor = useWatch({ control: form.control, name: "isMinor" });
  const scope = useWatch({ control: form.control, name: "scope" });
  const sessionIds = useWatch({ control: form.control, name: "sessionIds" });
  const termsError = form.formState.errors.acceptTerms?.message;
  const daysError = form.formState.errors.sessionIds?.message;
  const pending = form.formState.isSubmitting || leaving;

  const perDay = event.billingMode === "per_day" && event.sessions.length > 1;
  const chosenDays = perDay && scope === "days" ? sessionIds.length : event.sessions.length;
  const amount =
    event.billingMode === "free" ? 0 : event.billingMode === "per_day" ? (event.dayPriceCents ?? 0) * chosenDays : event.priceCents;

  if (result) return <SignupResult result={result} event={event} />;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const days = perDay && values.scope === "days";
    const response = await submitEventSignupAction({
      code: event.code,
      name: values.name,
      phone: values.isMinor ? (values.guardianPhone ?? "") : values.phone,
      email: values.email,
      isMinor: values.isMinor,
      ...(values.isMinor ? { guardianName: values.guardianName, guardianPhone: values.guardianPhone } : {}),
      scope: days ? "days" : "full",
      ...(days ? { sessionIds: values.sessionIds } : {}),
      acceptTerms: values.acceptTerms,
      acceptWhatsapp: values.acceptWhatsapp,
      website: values.website,
    });
    if (response.ok) {
      const done = response.result;
      // Confirmada ou reservada: vai para a pagina do ingresso, que tem endereco
      // proprio (atualizar a pagina nao perde o ingresso) e o "Pagar agora".
      if (done.ticketCode && (done.status === "confirmed" || done.status === "reserved")) {
        rememberSignup(event.code, { ticketCode: done.ticketCode, displayName: done.displayName });
        setLeaving(true);
        router.replace(`/p/i/${done.ticketCode}?nova=1${done.emailSent ? "&email=1" : ""}`);
        return;
      }
      setResult(done);
      return;
    }
    // Erro por campo: embaixo do campo, com o foco nele; o resto, no fim.
    if (response.fields?.length) {
      handleFormApiError({ code: "VALIDATION", message: response.error, fields: response.fields }, form, response.error);
      return;
    }
    setError(response.error);
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {remembered.length > 0 ? (
          <section className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex gap-3">
              <Ticket className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <p className="text-sm font-semibold text-foreground">Você se inscreveu neste aparelho</p>
            </div>
            {remembered.map((item) => (
              <div key={item.ticketCode} className="flex items-center justify-between gap-3 pl-8">
                <span className="min-w-0 break-words text-sm text-foreground">{item.displayName}</span>
                <Button asChild variant="outline">
                  <a href={`/p/i/${item.ticketCode}`}>
                    <Ticket className="size-4" />
                    Ver ingresso
                  </a>
                </Button>
              </div>
            ))}
          </section>
        ) : null}
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">{remembered.length > 0 ? "Inscrever outra pessoa" : "Inscrição"}</h2>
          <p className="text-sm text-muted-foreground">
            {event.isFull ? "O evento lotou: entre na lista de espera." : "Preencha os dados para garantir a vaga."}
          </p>
        </div>

        <InputText<SignupValues>
          name="name"
          label={isMinor ? "Nome do participante" : "Nome"}
          placeholder="Informe o nome completo"
          autoComplete="name"
          required
          disabled={pending}
        />
        <SwitchField<SignupValues> name="isMinor" label="Participante menor de 18 anos" hint="Pede os dados do responsável." disabled={pending} />

        {isMinor ? (
          <>
            <InputText<SignupValues>
              name="guardianName"
              label="Nome do responsável"
              placeholder="Informe o nome do responsável"
              required
              disabled={pending}
            />
            <InputPhone<SignupValues> name="guardianPhone" label="WhatsApp do responsável" required disabled={pending} />
          </>
        ) : (
          <InputPhone<SignupValues> name="phone" label="WhatsApp" required disabled={pending} />
        )}

        <InputText<SignupValues>
          name="email"
          label={isMinor ? "E-mail do responsável" : "E-mail"}
          type="email"
          placeholder="Informe o e-mail"
          hint="Enviamos o link do ingresso para ele."
          autoComplete="email"
          required
          disabled={pending}
        />

        {perDay ? (
          <div className="space-y-3">
            <FieldShell label="Dias">
              <SegmentedChoiceField<SignupValues>
                name="scope"
                ariaLabel="Dias"
                options={[
                  { value: "full", label: "Todos os dias" },
                  { value: "days", label: "Só alguns dias" },
                ]}
                disabled={pending}
              />
            </FieldShell>
            {scope === "days" ? (
              <FieldShell label="Quais dias" required error={daysError} invalid={Boolean(daysError)}>
                <Controller
                  control={form.control}
                  name="sessionIds"
                  render={({ field }) => (
                    <div className="space-y-2">
                      {event.sessions.map((s) => {
                        const checked = field.value.includes(s.id);
                        return (
                          <label key={s.id} className="flex items-center gap-2 text-sm text-foreground">
                            <Checkbox
                              checked={checked}
                              disabled={pending}
                              onCheckedChange={(v) =>
                                field.onChange(v === true ? [...field.value, s.id] : field.value.filter((id) => id !== s.id))
                              }
                            />
                            {format(parseISO(s.date), "EEE, dd/MM", { locale: ptBR })} · {s.start} às {s.end}
                          </label>
                        );
                      })}
                    </div>
                  )}
                />
              </FieldShell>
            ) : null}
            {/* Por dia o total muda com os dias escolhidos: aparece aqui (o valor do topo e por dia). */}
            {!event.isFull ? (
              <p className="flex items-baseline justify-between text-sm text-muted-foreground">
                Total
                <span className="text-base font-semibold text-foreground">{formatCents(amount)}</span>
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Campo-armadilha: escondido de quem usa a pagina; robo preenche. */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Site
            <input tabIndex={-1} autoComplete="off" {...form.register("website")} />
          </label>
        </div>

        {/* Aceite obrigatorio: mesmo bloco do contrato da conta de recebimento. */}
        <div
          data-field-error={termsError ? "" : undefined}
          className={cn(
            "space-y-1.5 rounded-lg border p-3 transition-colors",
            termsError ? "border-destructive bg-destructive/5 ring-1 ring-destructive/40" : "border-border/90 bg-muted/30",
          )}
        >
          <div className="flex items-start gap-2.5">
            <Controller
              control={form.control}
              name="acceptTerms"
              render={({ field }) => (
                <Checkbox
                  id="acceptTerms"
                  ref={field.ref}
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  disabled={pending}
                  aria-invalid={Boolean(termsError)}
                  aria-describedby={termsError ? "acceptTerms-error" : undefined}
                  className={cn("mt-0.5", termsError && "border-destructive")}
                />
              )}
            />
            <div className="space-y-1 text-xs">
              <label htmlFor="acceptTerms" className="cursor-pointer font-medium leading-snug text-foreground">
                {isMinor ? EVENT_SIGNUP_TERMS.guardianText : EVENT_SIGNUP_TERMS.text}
              </label>
              <Link href="/privacy" target="_blank" className="block text-[11px] font-medium text-primary hover:underline">
                Ler a Política de Privacidade
              </Link>
            </div>
          </div>
          {termsError ? (
            <p id="acceptTerms-error" className="text-xs text-destructive">
              {termsError}
            </p>
          ) : null}
        </div>

        <SwitchField<SignupValues>
          name="acceptWhatsapp"
          label="Receber mensagens do espaço pelo WhatsApp"
          hint="Avisos e lembretes do evento. Opcional."
          disabled={pending}
        />

        {error ? (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending
            ? leaving
              ? "Abrindo o ingresso..."
              : "Enviando..."
            : event.isFull
              ? "Entrar na lista de espera"
              : "Inscrever"}
        </Button>
        {amount > 0 && !event.isFull && event.seatGuarantee === "on_payment" ? (
          <p className="text-center text-xs text-muted-foreground">
            A vaga fica reservada por {event.holdMinutes} minutos até o pagamento.
          </p>
        ) : null}
      </form>
    </FormProvider>
  );
}


/**
 * O que fica nesta pagina: ja inscrito e lista de espera. Confirmada ou
 * reservada vai para a pagina do ingresso (ver `onSubmit`).
 */
function SignupResult({ result, event }: { result: PublicEventSignupResult; event: PublicEventView }) {
  const payHref = result.chargeId && event.onlinePayments ? `/p/c/${result.chargeId}` : null;
  const ticketHref = result.ticketCode ? `/p/i/${result.ticketCode}` : null;

  const box = (icon: React.ReactNode, title: string, text: string, tone: "ok" | "wait" = "ok") => (
    <div className="space-y-3 text-center">
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
    return box(<CheckCircle2 className="size-6" />, "Você já está inscrito", "Este telefone já tem inscrição neste evento. O link do ingresso está no e-mail da inscrição; se não tiver, peça ao espaço.");
  }
  if (result.status === "waitlist") {
    return box(<Hourglass className="size-6" />, "Você está na lista de espera", "O evento lotou. O espaço avisa se abrir vaga.", "wait");
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
