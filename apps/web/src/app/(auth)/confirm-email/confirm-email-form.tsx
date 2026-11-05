"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmAccessEmailChangeAction } from "../email-change-actions";

/** Confirma a troca do e-mail de acesso; depois, o login ja vem com o e-mail novo. */
export function ConfirmEmailForm({ token, maskedNewEmail }: { token: string; maskedNewEmail: string }) {
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; expired?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await confirmAccessEmailChangeAction({ token });
      if (result.ok) setDone(result.newEmail);
      else setError({ message: result.message, expired: result.expired });
    });
  };

  if (done) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-foreground">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <p>Pronto. Seu e-mail de acesso agora é {maskedNewEmail}. A senha continua a mesma.</p>
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
