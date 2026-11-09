"use client";

import { RequiredMark } from "@/components/form";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction } from "../password-reset-actions";

/** Pede o link de nova senha. A resposta nao diz se o e-mail tem conta. */
export function ForgotPasswordForm({ initialEmail }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordResetAction({ email });
      if (result.ok) setSentTo(email.trim());
      else setError(result.message);
    });
  };

  if (sentTo) {
    return (
      <div className="space-y-5">
        <div role="status" className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
            <Mail className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1 text-sm">
            <p className="text-base font-semibold text-foreground">Confira seu e-mail</p>
            <p className="leading-relaxed text-muted-foreground">
              Se <strong className="break-words text-foreground">{sentTo}</strong> tiver uma conta com senha, o link chega
              em instantes. Ele vale por 1 hora. Não chegou? Veja o spam.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Criou a conta com o Google? Não precisa de senha: use &quot;Continuar com Google&quot; no login.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Voltar para o login</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="forgot-email">
          <span>
            E-mail
            <RequiredMark />
          </span>
        </Label>
        <Input
          id="forgot-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Informe o e-mail da sua conta"
          autoComplete="email"
          required
          disabled={pending}
          aria-invalid={Boolean(error)}
        />
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={pending} className="w-full gap-2">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {pending ? "Enviando..." : "Enviar link"}
        {pending ? null : <ArrowRight className="size-4" aria-hidden />}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Lembrou?{" "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Voltar para o login
        </Link>
      </p>
    </form>
  );
}
