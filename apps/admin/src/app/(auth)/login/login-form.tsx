"use client";

import { FormProvider } from "react-hook-form";
import { signInAction, type FormState } from "@/app/actions/auth";
import { FormFeedback, InputText, useActionForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loginSchema } from "@/lib/form-schemas";

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const { form, state, pending, submit } = useActionForm<typeof loginSchema, FormState>({
    schema: loginSchema,
    defaultValues: { email: "", password: "", next },
    action: signInAction,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar no painel</CardTitle>
        <CardDescription>Use seu e-mail e sua senha. Depois, o código do aplicativo autenticador.</CardDescription>
      </CardHeader>
      <CardContent>
        <FormProvider {...form}>
          <form onSubmit={submit()} className="space-y-4" noValidate>
            {notice ? (
              <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                {notice}
              </p>
            ) : null}
            <InputText name="email" label="E-mail" type="email" autoComplete="username" required />
            <InputText name="password" label="Senha" type="password" autoComplete="current-password" required />
            <FormFeedback state={state} />
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Entrando..." : "Continuar"}
            </Button>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}
