"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, Clock, Loader2, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputText } from "@/components/form";
import { cn } from "@/lib/utils";
import { requestSignupLink } from "@/app/(auth)/signup-actions";
import { trackEvent } from "@/lib/analytics";
import { signupSchema, type SignupValues } from "../signup-schema";

function SubmitButton({ pending, className }: { pending: boolean; className?: string }) {
  return (
    <Button type="submit" disabled={pending} className={cn("gap-2 font-semibold", className)}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Enviando link de acesso…
        </>
      ) : (
        <>
          Criar conta grátis
          <ArrowRight className="size-4" />
        </>
      )}
    </Button>
  );
}

/** "Já tem conta? Entrar" */
export function SignupLoginLink({ className }: { className?: string }) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      Já tem conta?{" "}
      <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
        Entrar
      </Link>
    </p>
  );
}

interface SignupFormProps {
  /** Prefixo dos ids dos campos. */
  idPrefix: string;
  className?: string;
}

interface PendingLinkModalState {
  open: boolean;
  name: string;
  email: string;
}

/**
 * Formulario de cadastro rapido na Landing Page (nome e e-mail):
 * - Envia um link de 24h via MailerSend para o usuario definir a senha no `/login`
 * - Se ja existir um link enviado e ainda nao expirado (sem senha criada), abre
 *   uma modal informando que o link ja foi enviado e que expira em 24h, dando a
 *   opcao de gerar e enviar um novo link (expirando o anterior na hora).
 */
export function SignupForm({ idPrefix, className }: SignupFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [accountExistsEmail, setAccountExistsEmail] = useState<string | null>(null);
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);
  const [pendingModal, setPendingModal] = useState<PendingLinkModalState | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isResending, startResendTransition] = useTransition();

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "" },
  });

  const onSubmit = form.handleSubmit(({ name, email }) => {
    setSubmitError(null);
    setAccountExistsEmail(null);

    startTransition(async () => {
      const result = await requestSignupLink({ name, email, forceResend: false });
      trackEvent("landing_signup_submitted", { result: result.status });

      if (result.status === "sent") {
        setSentToEmail(result.email);
        return;
      }

      if (result.status === "pending_link_exists") {
        setPendingModal({
          open: true,
          name: result.name || name,
          email: result.email,
        });
        return;
      }

      if (result.status === "account_exists") {
        setAccountExistsEmail(result.email);
        return;
      }

      setSubmitError(result.message);
    });
  });

  const handleConfirmGenerateNewLink = () => {
    if (!pendingModal) return;
    setSubmitError(null);

    startResendTransition(async () => {
      const result = await requestSignupLink({
        name: pendingModal.name,
        email: pendingModal.email,
        forceResend: true,
      });

      if (result.status === "sent") {
        const targetEmail = result.email;
        setPendingModal(null);
        setSentToEmail(targetEmail);
        toast.success("Novo link enviado! O link anterior foi expirado.");
        return;
      }

      if (result.status === "error") {
        toast.error(result.message);
      }
    });
  };

  if (sentToEmail) {
    return (
      <div
        role="status"
        className={cn(
          "rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-left space-y-3",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="space-y-1 min-w-0">
            <h3 className="text-base font-bold text-foreground">
              Verifique seu e-mail para criar sua senha
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Enviamos um link de acesso para{" "}
              <strong className="font-semibold text-foreground break-all">{sentToEmail}</strong>.
              Clique no botão do e-mail para definir sua senha e configurar seu espaço.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <Clock className="size-3.5 shrink-0" />
          <span>Este link é válido por 24 horas. Verifique também a caixa de spam ou promoções.</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setSentToEmail(null);
              setSubmitError(null);
            }}
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline cursor-pointer"
          >
            Usar outro e-mail
          </button>

          <button
            type="button"
            disabled={isResending}
            onClick={() => {
              const values = form.getValues();
              setPendingModal({
                open: true,
                name: values.name || "Gestor",
                email: sentToEmail,
              });
            }}
            className="text-xs font-semibold text-primary underline-offset-4 hover:underline cursor-pointer disabled:opacity-50"
          >
            Não recebeu? Gerar novo link
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <FormProvider {...form}>
        <form onSubmit={onSubmit} noValidate className={cn("space-y-4", className)}>
          <div className="space-y-4">
            <InputText<SignupValues>
              name="name"
              id={`${idPrefix}-name`}
              label="Nome"
              placeholder="Informe seu nome"
              autoComplete="name"
              required
              disabled={isPending}
            />
            <InputText<SignupValues>
              name="email"
              id={`${idPrefix}-email`}
              type="email"
              label="E-mail"
              placeholder="Informe seu e-mail"
              autoComplete="email"
              required
              disabled={isPending}
            />
            <SubmitButton pending={isPending} className="w-full" />
          </div>

          {accountExistsEmail ? (
            <div
              role="alert"
              className="rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-2.5 text-sm text-foreground"
            >
              Já existe uma conta cadastrada com <strong>{accountExistsEmail}</strong>.{" "}
              <Link
                href={`/login?email=${encodeURIComponent(accountExistsEmail)}`}
                className="font-semibold text-primary underline underline-offset-4"
              >
                Entrar na minha conta &rarr;
              </Link>
            </div>
          ) : null}

          {submitError ? (
            <p role="alert" className="text-sm text-destructive">
              {submitError}
            </p>
          ) : null}

          <p className="text-xs leading-relaxed text-muted-foreground">
            Ao criar a conta, você aceita os{" "}
            <Link href="/terms" className="font-medium text-foreground underline-offset-4 hover:underline">
              Termos de uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacy" className="font-medium text-foreground underline-offset-4 hover:underline">
              Política de privacidade
            </Link>
            .
          </p>
        </form>
      </FormProvider>

      {/* Modal quando ja foi enviado um link nas ultimas 24h e o usuario ainda nao criou a senha */}
      <Dialog
        open={Boolean(pendingModal?.open)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isResending) {
            setPendingModal(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md" closeOnInteractOutside={!isResending}>
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Mail className="size-5" />
            </div>
            <DialogTitle>Link de acesso já enviado</DialogTitle>
            <DialogDescription>
              Já enviamos um link de criação de conta para{" "}
              <strong className="font-semibold text-foreground break-all">
                {pendingModal?.email}
              </strong>
              . Ele continua válido e expira em <strong>24 horas</strong> a partir do envio.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
            Deseja gerar e enviar um novo link agora? O link anterior será{" "}
            <strong>expirado imediatamente</strong> e deixará de funcionar.
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isResending}
              onClick={() => setPendingModal(null)}
            >
              Fechar
            </Button>
            <Button
              type="button"
              disabled={isResending}
              onClick={handleConfirmGenerateNewLink}
              className="gap-2 font-semibold"
            >
              {isResending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Gerando novo link…
                </>
              ) : (
                <>
                  <RefreshCw className="size-4" />
                  Gerar e enviar novo link
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
