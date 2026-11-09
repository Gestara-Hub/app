"use client";

import { RequiredMark } from "@/components/form";
import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_TOO_SHORT_MESSAGE, isPasswordLongEnough } from "@/lib/password-rules";
import { confirmAccessEmailChangeAction } from "../email-change-actions";

/** Confirma a troca do e-mail de acesso; depois, o login ja vem com o e-mail novo. */
export function ConfirmEmailForm({
  token,
  maskedNewEmail,
  needsPassword,
}: {
  token: string;
  maskedNewEmail: string;
  /** Conta que entrava so pelo Google: cria a senha ao confirmar. */
  needsPassword: boolean;
}) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; expired?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    setError(null);
    if (needsPassword) {
      if (!isPasswordLongEnough(password)) return setError({ message: PASSWORD_TOO_SHORT_MESSAGE });
      if (password !== repeat) return setError({ message: "As senhas não são iguais." });
    }
    startTransition(async () => {
      const result = await confirmAccessEmailChangeAction(needsPassword ? { token, password } : { token });
      if (result.ok) setDone(result.newEmail);
      else setError({ message: result.message, expired: result.expired });
    });
  };

  if (done) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-foreground">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <p>
            Pronto. Seu e-mail de acesso agora é {maskedNewEmail}.{" "}
            {needsPassword ? "Entre com ele e a senha que você criou." : "A senha continua a mesma."}
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href={`/login?email=${encodeURIComponent(done)}`}>Ir para o login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Você vai passar a entrar com <strong className="font-medium text-foreground">{maskedNewEmail}</strong>.
      </p>
      {needsPassword ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="confirm-new-password">
              <span>
                Nova senha
                <RequiredMark />
              </span>
            </Label>
            <Input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-repeat-password">
              <span>
                Repita a senha
                <RequiredMark />
              </span>
            </Label>
            <Input
              id="confirm-repeat-password"
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
              disabled={pending}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            O login pelo Google antigo deixa de valer.
          </p>
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground"
        >
          <Clock className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <p>{error.message}</p>
        </div>
      ) : null}
      {error?.expired ? (
        <Button asChild className="w-full">
          <Link href="/login">Ir para o login</Link>
        </Button>
      ) : (
        <Button type="button" className="w-full" onClick={confirm} disabled={pending}>
          {pending ? "Confirmando..." : "Confirmar novo e-mail"}
        </Button>
      )}
    </div>
  );
}
