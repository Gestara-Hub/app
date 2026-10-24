"use client";

import { FormProvider } from "react-hook-form";
import { verifyMfaAction, type FormState } from "@/app/actions/auth";
import { FormFeedback, InputText, useActionForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mfaSchema } from "@/lib/form-schemas";

interface Props {
  mode: "verify" | "enroll";
  factorId: string;
  next: string;
  qrCode?: string;
  secret?: string;
}

export function MfaForm({ mode, factorId, next, qrCode, secret }: Props) {
  const { form, state, pending, submit } = useActionForm<typeof mfaSchema, FormState>({
    schema: mfaSchema,
    defaultValues: { factorId, next: next === "/" ? "" : next, code: "" },
    action: verifyMfaAction,
  });
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
        <FormProvider {...form}>
          <form onSubmit={submit()} className="space-y-4" noValidate>
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
          <InputText
            name="code"
            label="Código de 6 números"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            required
            inputClassName="text-center font-mono tracking-widest"
          />
          <FormFeedback state={state} />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Conferindo..." : enrolling ? "Confirmar e entrar" : "Entrar"}
          </Button>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}
