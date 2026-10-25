"use client";

import { FormProvider } from "react-hook-form";
import type { FormState } from "@/app/actions/auth";
import { FormFeedback, InputText, useActionForm } from "@/components/form";
import { AuthCard } from "@/components/shared/auth-card";
import { Button } from "@/components/ui/button";
import { acceptSchema } from "@/lib/form-schemas";
import { acceptInviteAction } from "./actions";

export function AcceptForm({ token }: { token: string }) {
  const { form, state, pending, submit } = useActionForm<typeof acceptSchema, FormState>({
    schema: acceptSchema,
    defaultValues: { token, password: "", confirm: "" },
    action: acceptInviteAction,
  });
  if (!token) {
    return <AuthCard title="Convite inválido" subtitle="Abra o link completo que veio no e-mail do convite." />;
  }
  return (
    <AuthCard title="Criar sua senha" subtitle="Depois você configura o aplicativo autenticador, que é pedido em toda entrada.">
      <FormProvider {...form}>
        <form onSubmit={submit()} className="space-y-4" noValidate>
          <InputText name="password" label="Senha (12 ou mais caracteres)" type="password" autoComplete="new-password" required />
          <InputText name="confirm" label="Repita a senha" type="password" autoComplete="new-password" required />
          <FormFeedback state={state} />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando..." : "Criar senha e continuar"}
          </Button>
        </form>
      </FormProvider>
    </AuthCard>
  );
}
