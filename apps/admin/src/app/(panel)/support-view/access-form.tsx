"use client";

import { FormProvider } from "react-hook-form";
import { FormFeedback, TextArea, useActionForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { accessSchema } from "@/lib/form-schemas";
import { startAccessAction, type AccessFormState } from "./actions";

/** Pede o motivo e abre a visão de suporte do espaço. */
export function AccessForm({ spaceId }: { spaceId: string }) {
  const { form, state, pending, submit } = useActionForm<typeof accessSchema, AccessFormState>({
    schema: accessSchema,
    defaultValues: { spaceId, reason: "" },
    action: startAccessAction,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ver como o suporte</CardTitle>
        <CardDescription>
          Visão só de leitura, por 30 minutos, com a configuração e os totais do espaço. Não mostra nome, telefone nem dados dos alunos. O dono vê o aviso na Auditoria dele.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormProvider {...form}>
          <form onSubmit={submit()} className="space-y-3" noValidate>
            <TextArea name="reason" label="Motivo (fica registrado)" rows={2} maxLength={300} />
            <FormFeedback state={state} />
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Abrindo..." : "Abrir visão de suporte"}
            </Button>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}
