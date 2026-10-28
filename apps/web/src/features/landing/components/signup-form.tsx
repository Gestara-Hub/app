"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2, LogIn, Mail, RefreshCw, ShieldCheck, UserCheck } from "lucide-react";
import { toast } from "@/lib/toast";
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
  /**
   * "Entrar" quando o e-mail ja tem conta. Na tela de login troca de aba sem
   * sair da pagina; sem ele, o botao leva para o /login.
   */
  onSignIn?: (email: string) => void;
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
export function SignupForm({ idPrefix, className, onSignIn }: SignupFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [existingAccount, setExistingAccount] = useState<{ email: string; googleOnly: boolean } | null>(null);
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
    setExistingAccount(null);

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
        setExistingAccount({ email: result.email, googleOnly: result.googleOnly });
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
      <div role="status" className={cn("space-y-4 text-left", className)}>
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
            <Mail className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <h3 className="text-base font-semibold text-foreground">Confira seu e-mail</h3>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                Enviamos um link para você criar sua senha:
              </p>
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2">
              <p className="text-sm font-medium text-foreground break-words select-all">
                {sentToEmail}
              </p>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Ele vale por 24 horas. Não chegou? Veja o spam.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-sm">
          <button
            type="button"
            onClick={() => {
              setSentToEmail(null);
              setSubmitError(null);
            }}
            className="cursor-pointer text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
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
            className="cursor-pointer font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-50"
          >
            Reenviar link
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <FormProvider {...form}>
        <form onSubmit={onSubmit} noValidate className={cn("space-y-4", className)}>
          <div className="space-y-5">
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
            <div className="space-y-2">
              <SubmitButton pending={isPending} className="w-full" />
              {/* O cadastro segue por um link no e-mail: avisa antes, para ninguem esperar senha aqui. */}
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="size-3.5 shrink-0" aria-hidden />
                Enviamos um link de acesso para o seu e-mail.
              </p>
            </div>
          </div>

          {existingAccount ? (
            <div role="alert" className="flex gap-3 rounded-xl border border-border bg-muted/50 p-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserCheck className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">Você já tem conta</p>
                  <p className="text-sm break-words text-muted-foreground">
                    {existingAccount.googleOnly
                      ? `${existingAccount.email} entra pelo Google.`
                      : `${existingAccount.email} já está cadastrado.`}
                  </p>
                </div>
                {onSignIn ? (
                  <Button type="button" variant="outline" className="w-full gap-2" onClick={() => onSignIn(existingAccount.email)}>
                    <LogIn className="size-4" aria-hidden />
                    {existingAccount.googleOnly ? "Entrar com o Google" : "Entrar com este e-mail"}
                  </Button>
                ) : (
                  <Button asChild variant="outline" className="w-full gap-2">
                    <Link
                      href={
                        existingAccount.googleOnly
                          ? "/login"
                          : `/login?email=${encodeURIComponent(existingAccount.email)}`
                      }
                    >
                      <LogIn className="size-4" aria-hidden />
                      {existingAccount.googleOnly ? "Entrar com o Google" : "Entrar com este e-mail"}
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          ) : null}

          {submitError ? (
            <p role="alert" className="text-sm text-destructive">
              {submitError}
            </p>
          ) : null}

          <div className="space-y-2 border-t border-border/60 pt-4 text-xs leading-relaxed text-muted-foreground">
            <p>
              Leia os{" "}
              <Link href="/terms" className="whitespace-nowrap font-medium text-foreground underline-offset-4 hover:underline">
                Termos de uso
              </Link>{" "}
              e a{" "}
              <Link href="/privacy" className="whitespace-nowrap font-medium text-foreground underline-offset-4 hover:underline">
                Política de privacidade
              </Link>
              .
            </p>
            <p className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
              Seus dados protegidos, conforme a LGPD.
            </p>
          </div>
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
              <strong className="font-semibold text-foreground break-words">
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
