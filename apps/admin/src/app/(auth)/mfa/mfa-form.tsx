"use client";

import { useState } from "react";
import { FormProvider } from "react-hook-form";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { verifyMfaAction, type FormState } from "@/app/actions/auth";
import { FormFeedback, InputText, useActionForm } from "@/components/form";
import { AuthCard } from "@/components/shared/auth-card";
import { Button } from "@/components/ui/button";
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
  const [copied, setCopied] = useState(false);
  return (
    <AuthCard
      title={enrolling ? "Configure o aplicativo autenticador" : "Digite o código"}
      subtitle={enrolling ? "O painel exige verificação em duas etapas. Siga os passos abaixo." : "Abra o aplicativo autenticador e digite o código de 6 números."}
    >
      <FormProvider {...form}>
        <form onSubmit={submit()} className="space-y-4" noValidate>
          {enrolling && qrCode ? (
            <div className="space-y-4">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Abra o Google Authenticator, o 1Password ou similar.</li>
                <li>Escaneie o QR code abaixo.</li>
                <li>Digite o código de 6 números que aparecer.</li>
              </ol>
              {/* QR gerado pelo Supabase (SVG em data URI). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="QR code do aplicativo autenticador" className="mx-auto size-44 rounded-lg border bg-white p-2" />
              <div className="space-y-2 rounded-md border bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Sem câmera? Digite esta chave no aplicativo:</p>
                <p data-mfa-secret className="break-all font-mono text-xs select-all">{secret}</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(secret ?? "");
                      setCopied(true);
                    } catch {
                      toast.error("Não foi possível copiar. Selecione a chave e copie.");
                    }
                  }}
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied ? "Copiada" : "Copiar chave"}
                </Button>
              </div>
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
    </AuthCard>
  );
}
