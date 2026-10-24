"use client";

import { useActionState } from "react";
import { verifyMfaAction, type FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: FormState = {};

interface Props {
  mode: "verify" | "enroll";
  factorId: string;
  next: string;
  qrCode?: string;
  secret?: string;
}

export function MfaForm({ mode, factorId, next, qrCode, secret }: Props) {
  const [state, action, pending] = useActionState(verifyMfaAction, INITIAL);
  const enrolling = mode === "enroll";
  return (
    <Card>
      <CardHeader>
        <CardTitle>{enrolling ? "Configure o aplicativo autenticador" : "Digite o código"}</CardTitle>
        <CardDescription>
          {enrolling
            ? "O painel exige verificação em duas etapas. Escaneie o QR com o Google Authenticator, 1Password ou similar e digite o código de 6 números."
            : "Abra o aplicativo autenticador e digite o código de 6 números."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="factorId" value={factorId} />
          <input type="hidden" name="next" value={next === "/" ? "" : next} />
          {enrolling && qrCode ? (
            <div className="space-y-2">
              {/* QR gerado pelo Supabase (SVG em data URI). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="QR code do aplicativo autenticador" className="mx-auto size-44 rounded-md bg-white p-2" />
              <p className="text-center text-xs text-muted-foreground">
                Sem câmera? Digite este código no aplicativo:
              </p>
              <p className="text-center font-mono text-xs break-all select-all">{secret}</p>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="code">Código de 6 números</Label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              required
              className="text-center font-mono text-base tracking-widest md:text-sm"
            />
          </div>
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Conferindo..." : enrolling ? "Confirmar e entrar" : "Entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
