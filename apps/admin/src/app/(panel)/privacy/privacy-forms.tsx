"use client";

import { FormProvider } from "react-hook-form";
import { FormFeedback, InputText, SelectField, TextArea, useActionForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { privacyRequestSchema, privacyUpdateSchema } from "@/lib/form-schemas";
import { createRequestAction, updateRequestAction, type PrivacyFormState } from "./actions";

const KINDS = [
  ["access", "Acesso aos dados"],
  ["correction", "Correção de dados"],
  ["deletion", "Exclusão de dados"],
  ["portability", "Portabilidade"],
  ["revoke_consent", "Revogar consentimento"],
  ["other", "Outro"],
] as const;
const STATUSES = [
  ["open", "Aberto"],
  ["in_progress", "Em andamento"],
  ["done", "Concluído"],
  ["rejected", "Recusado"],
] as const;

export function NewRequestForm() {
  const { form, state, pending, submit } = useActionForm<typeof privacyRequestSchema, PrivacyFormState>({
    schema: privacyRequestSchema,
    defaultValues: { requesterName: "", requesterEmail: "", kind: "access", description: "", spaceId: "" },
    action: createRequestAction,
    resetOnSuccess: true,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Registrar pedido do titular</CardTitle>
        <CardDescription>Quando alguém pede acesso, correção, exclusão ou portabilidade dos dados. O prazo de resposta é de 15 dias.</CardDescription>
      </CardHeader>
      <CardContent>
        <FormProvider {...form}>
          <form onSubmit={submit()} className="space-y-3" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <InputText name="requesterName" id="req-name" label="Nome de quem pediu" required maxLength={120} />
              <InputText name="requesterEmail" id="req-email" label="E-mail" type="email" required />
              <SelectField name="kind" id="req-kind" label="Tipo" options={KINDS} />
              <InputText name="spaceId" id="req-space" label="Código do espaço (se souber)" inputClassName="font-mono" />
            </div>
            <TextArea name="description" id="req-description" label="O que foi pedido" required rows={3} maxLength={2000} />
            <FormFeedback state={state} />
            <Button type="submit" disabled={pending}>
              {pending ? "Registrando..." : "Registrar pedido"}
            </Button>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}

export function UpdateRequestForm({ id, status, resolution }: { id: string; status: string; resolution: string }) {
  const { form, state, pending, submit } = useActionForm<typeof privacyUpdateSchema, PrivacyFormState>({
    schema: privacyUpdateSchema,
    defaultValues: { id, status: status as "open", resolution },
    action: updateRequestAction,
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={submit()} className="space-y-2" noValidate>
        <div className="flex flex-wrap items-start gap-2">
          <SelectField name="status" id={`status-${id}`} options={STATUSES} className="w-auto" />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            Salvar
          </Button>
        </div>
        <TextArea
          name="resolution"
          id={`resolution-${id}`}
          rows={2}
          placeholder="O que foi feito (obrigatório para concluir ou recusar)"
          maxLength={2000}
          ariaLabel="O que foi feito"
        />
        <FormFeedback state={state} />
      </form>
    </FormProvider>
  );
}
