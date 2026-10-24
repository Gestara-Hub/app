"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCountdown } from "@/hooks/use-countdown";
import { settingsService } from "@/services/settings/settingsService";
import {
  cancelTwoFactorSignInAction,
  sendSignInEmailCodeAction,
  verifyTwoFactorSignInAction,
} from "../two-factor-actions";

/**
 * Codigo de 6 numeros do aplicativo ou do e-mail; ao acertar, entra no app.
 * Com o app ligado, comeca por ele e oferece o e-mail como alternativa. Com o
 * e-mail, manda o codigo sozinho ao abrir (uma vez).
 */
export function TwoFactorForm({
  from,
  email,
  maskedEmail,
  hasApp,
  hasEmail,
}: {
  from: string;
  email: string;
  maskedEmail: string;
  hasApp: boolean;
  hasEmail: boolean;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<"app" | "email" | "recovery">(hasApp ? "app" : "email");
  // Para voltar do codigo de recuperacao ao metodo que a pessoa tinha.
  const mainMethod: "app" | "email" = hasApp ? "app" : "email";
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [sending, startSending] = useTransition();
  const [leaving, startLeaving] = useTransition();
  const resend = useCountdown();
  const autoSent = useRef(false);

  const sendCode = () => {
    setError(null);
    startSending(async () => {
      const result = await sendSignInEmailCodeAction();
      if (result.ok) {
        setSentTo(result.maskedEmail);
        resend.start(result.resendInSeconds);
        return;
      }
      if (result.resendInSeconds) {
        // Ja havia um codigo recente: ele continua valendo.
        setSentTo(maskedEmail);
        resend.start(result.resendInSeconds);
        return;
      }
      setError(result.message);
    });
  };

  // E-mail: manda o codigo ao abrir a tela ou ao trocar para o e-mail (uma vez).
  useEffect(() => {
    if (method !== "email" || autoSent.current) return;
    autoSent.current = true;
    sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  const switchMethod = (next: "app" | "email" | "recovery") => {
    setMethod(next);
    setCode("");
    setError(null);
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await verifyTwoFactorSignInAction({ code, method, remember, from });
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
      {method === "email" ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {sending && !sentTo ? "Enviando o código..." : sentTo ? `Enviamos um código para ${sentTo}.` : null}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="two-factor-code">
          {method === "app" ? "Código do aplicativo" : method === "recovery" ? "Código de recuperação" : "Código do e-mail"}
          <span className="ml-0.5 text-destructive">*</span>
        </Label>
        <Input
          id="two-factor-code"
          inputMode={method === "recovery" ? "text" : "numeric"}
          autoComplete="one-time-code"
          autoCapitalize={method === "recovery" ? "characters" : undefined}
          maxLength={method === "recovery" ? 9 : 6}
          value={code}
          onChange={(e) =>
            setCode(
              method === "recovery"
                ? e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 9)
                : e.target.value.replace(/\D/g, "").slice(0, 6),
            )
          }
          placeholder={method === "recovery" ? "ABCD-EFGH" : "000000"}
          className={
            method === "recovery"
              ? "text-center font-mono text-lg tracking-widest md:text-lg"
              : "text-center font-mono text-lg tracking-[0.5em] md:text-lg"
          }
          disabled={pending}
          aria-invalid={Boolean(error)}
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="two-factor-remember"
          checked={remember}
          onCheckedChange={(value) => setRemember(Boolean(value))}
          disabled={pending}
        />
        <Label htmlFor="two-factor-remember" className="cursor-pointer font-normal">
          Lembrar este dispositivo por 30 dias
        </Label>
      </div>

      <Button
        type="submit"
        disabled={pending || (method === "recovery" ? code.replace(/-/g, "").length !== 8 : code.length !== 6)}
        className="w-full gap-2 font-semibold"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Entrar
        {pending ? null : <ArrowRight className="size-4" />}
      </Button>

      {method === "email" ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={sendCode}
          disabled={sending || resend.seconds > 0}
        >
          {resend.seconds > 0 ? `Reenviar código em ${resend.seconds} s` : "Reenviar código"}
        </Button>
      ) : null}

      {hasApp && hasEmail && method !== "recovery" ? (
        <p className="text-center text-sm">
          <button
            type="button"
            onClick={() => switchMethod(method === "app" ? "email" : "app")}
            className="cursor-pointer font-medium text-foreground underline-offset-4 hover:underline"
          >
            {method === "app" ? "Receber por e-mail" : "Usar o aplicativo"}
          </button>
        </p>
      ) : null}

      <p className="text-center text-sm">
        <button
          type="button"
          onClick={() => switchMethod(method === "recovery" ? mainMethod : "recovery")}
          className="cursor-pointer font-medium text-foreground underline-offset-4 hover:underline"
        >
          {method === "recovery" ? "Voltar ao código normal" : "Perdi o acesso ao código"}
        </button>
      </p>

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
