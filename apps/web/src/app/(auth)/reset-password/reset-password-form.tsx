"use client";

import { RequiredMark } from "@/components/form";
import { useState, useTransition } from "react";
import { MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT_MESSAGE, isPasswordLongEnough } from "@/lib/password-rules";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completePasswordResetAction } from "../password-reset-actions";
import { rememberPasswordReset } from "@/features/auth";
import { focusField } from "@/lib/form-errors";

/** Nova senha pelo link do e-mail; depois, o login ja vem com o e-mail preenchido. */
export function ResetPasswordForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Campo do erro: embaixo dele; sem campo (link vencido, falha do servidor), no fim.
  const [errorField, setErrorField] = useState<"password" | "confirm" | null>(null);
  const [expired, setExpired] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setErrorField(null);
    if (!isPasswordLongEnough(password)) {
      setError(PASSWORD_TOO_SHORT_MESSAGE);
      setErrorField("password");
      focusField("reset-password");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não são iguais.");
      setErrorField("confirm");
      focusField("reset-confirm");
      return;
    }
    startTransition(async () => {
      const result = await completePasswordResetAction({ token, password });
      if (result.ok) {
        // Ao entrar de novo, o aviso da verificacao em duas etapas (doc product/25).
        rememberPasswordReset();
        router.push(`/login?email=${encodeURIComponent(result.email)}&reset=ok`);
        return;
      }
      setError(result.message);
      setExpired(Boolean(result.expired));
    });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="reset-email" className="flex items-center justify-between">
          <span>E-mail</span>
          <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
            <Lock className="size-3" aria-hidden />
            Confirmado pelo link
          </span>
        </Label>
        <Input id="reset-email" type="email" value={email} disabled readOnly className="bg-muted/60 font-medium text-muted-foreground" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reset-password">
          <span>
            Nova senha
            <RequiredMark />
          </span>
        </Label>
        <div className="relative">
          <Input
            id="reset-password"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            placeholder={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`}
            autoComplete="new-password"
            aria-invalid={(error && errorField === "password") || undefined}
            aria-describedby={error && errorField === "password" ? "reset-field-error" : undefined}
            required
            disabled={pending}
            className="pr-10"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {error && errorField === "password" ? (
          <p id="reset-field-error" role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reset-confirm">
          <span>
            Confirmar nova senha
            <RequiredMark />
          </span>
        </Label>
        <Input
          id="reset-confirm"
          type={show ? "text" : "password"}
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Repita a nova senha"
          autoComplete="new-password"
          aria-invalid={(error && errorField === "confirm") || undefined}
          aria-describedby={error && errorField === "confirm" ? "reset-field-error" : undefined}
          required
          disabled={pending}
        />
        {error && errorField === "confirm" ? (
          <p id="reset-field-error" role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      {error && !errorField ? (
        <p role="alert" className="text-sm text-destructive">
          {error}{" "}
          {expired ? (
            <Link href="/forgot-password" className="font-semibold underline underline-offset-4">
              Pedir outro link
            </Link>
          ) : null}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full gap-2">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {pending ? "Salvando..." : "Salvar nova senha"}
      </Button>
    </form>
  );
}
