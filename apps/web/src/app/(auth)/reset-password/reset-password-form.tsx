"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completePasswordResetAction } from "../password-reset-actions";

/** Nova senha pelo link do e-mail; depois, o login ja vem com o e-mail preenchido. */
export function ResetPasswordForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não são iguais.");
    startTransition(async () => {
      const result = await completePasswordResetAction({ token, password });
      if (result.ok) {
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
          Nova senha<span className="ml-0.5 text-destructive">*</span>
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
            placeholder="Mínimo de 8 caracteres"
            autoComplete="new-password"
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
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reset-confirm">
          Confirmar nova senha<span className="ml-0.5 text-destructive">*</span>
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
          required
          disabled={pending}
        />
      </div>

      {error ? (
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
