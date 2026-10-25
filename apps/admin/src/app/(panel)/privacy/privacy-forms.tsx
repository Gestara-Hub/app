"use client";

import { FormProvider } from "react-hook-form";
import { toast } from "sonner";
import { FormFeedback, InputText, SelectField, TextArea, useActionForm } from "@/components/form";
import { DrawerBody, DrawerFooter, useDrawerClose } from "@/components/shared/form-drawer";
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

/** Conteúdo da gaveta "Registrar pedido": o botão que abre fica no cabeçalho da tela. */
export function NewRequestForm() {
  const close = useDrawerClose();
  const { form, state, pending, submit } = useActionForm<typeof privacyRequestSchema, PrivacyFormState>({
    schema: privacyRequestSchema,
    defaultValues: { requesterName: "", requesterEmail: "", kind: "access", description: "", spaceId: "" },
    action: createRequestAction,
    resetOnSuccess: true,
    onSuccess: (result) => {
      toast.success(result.message ?? "Pedido registrado.");
      close();
    },
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={submit()} className="flex min-h-0 flex-1 flex-col" noValidate>
        <DrawerBody>
          <InputText name="requesterName" id="req-name" label="Nome de quem pediu" required maxLength={120} />
          <InputText name="requesterEmail" id="req-email" label="E-mail" type="email" required />
          <SelectField name="kind" id="req-kind" label="Tipo" options={KINDS} />
          <InputText name="spaceId" id="req-space" label="Código do espaço (se souber)" inputClassName="font-mono" />
          <TextArea name="description" id="req-description" label="O que foi pedido" required rows={4} maxLength={2000} />
          <FormFeedback state={{ error: state.error }} />
        </DrawerBody>
        <DrawerFooter submitLabel="Adicionar" pending={pending} />
      </form>
    </FormProvider>
  );
}

/** Conteúdo da gaveta "Atualizar pedido": situação e o que foi feito. */
export function UpdateRequestForm({ id, status, resolution }: { id: string; status: string; resolution: string }) {
  const close = useDrawerClose();
  const { form, state, pending, submit } = useActionForm<typeof privacyUpdateSchema, PrivacyFormState>({
    schema: privacyUpdateSchema,
    defaultValues: { id, status: status as "open", resolution },
    action: updateRequestAction,
    onSuccess: (result) => {
      toast.success(result.message ?? "Pedido atualizado.");
      close();
    },
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={submit()} className="flex min-h-0 flex-1 flex-col" noValidate>
        <DrawerBody>
          <SelectField name="status" id={`status-${id}`} label="Situação" options={STATUSES} />
          <TextArea
            name="resolution"
            id={`resolution-${id}`}
            label="O que foi feito"
            hint="Obrigatório para concluir ou recusar."
            rows={5}
            maxLength={2000}
          />
          <FormFeedback state={{ error: state.error }} />
        </DrawerBody>
        <DrawerFooter submitLabel="Salvar" pending={pending} />
      </form>
    </FormProvider>
  );
}
