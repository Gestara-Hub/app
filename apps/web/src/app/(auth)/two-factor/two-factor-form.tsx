"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { settingsService } from "@/services/settings/settingsService";
import { cancelTwoFactorSignInAction, verifyTwoFactorSignInAction } from "../two-factor-actions";

/** Codigo de 6 numeros do aplicativo; ao acertar, entra no app. */
export function TwoFactorForm({ from, email }: { from: string; email: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [leaving, startLeaving] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await verifyTwoFactorSignInAction({ code, from });
      if (!result.ok) {
        setError(result.message);
        setCode("");
        return;
      }
      settingsService.hydrateTenant({
        organization: result.organization,
        unit: result.unit,
        user: result.user,
        categories: result.categories,
      });
      router.push(result.redirectTo);
      router.refresh();
    });
  };

  const useAnotherAccount = () => {
    startLeaving(async () => {
      await cancelTwoFactorSignInAction();
      router.push("/login");
    });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="two-factor-code">
          Código<span className="ml-0.5 text-destructive">*</span>
        </Label>
        <Input
          id="two-factor-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="text-center font-mono text-lg tracking-[0.5em] md:text-lg"
          disabled={pending}
          aria-invalid={Boolean(error)}
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={pending || code.length !== 6} className="w-full gap-2 font-semibold">
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Entrar
        {pending ? null : <ArrowRight className="size-4" />}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {email ? <span className="break-all">{email} · </span> : null}
        <button
          type="button"
          onClick={useAnotherAccount}
          disabled={leaving}
          className="cursor-pointer font-medium text-foreground underline-offset-4 hover:underline"
        >
          Usar outra conta
        </button>
      </p>
    </form>
  );
}
