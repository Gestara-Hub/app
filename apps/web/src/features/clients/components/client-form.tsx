"use client";

import { useForm, FormProvider, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { InputPhone, InputText, SwitchField, TextArea } from "@/components/form";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import { ORG_ID } from "@/config/tenant";
import type { Client, CreateClient } from "@gestarahub/contracts";
import { useCurrentUser, useModel } from "@/features/auth";
import { useCreateClient, useUpdateClient } from "../hooks/use-clients";
import { clientFormSchema, type ClientFormValues } from "../client-schema";

function toDefaults(client?: Client): ClientFormValues {
  return {
    name: client?.name ?? "",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    notes: client?.notes ?? "",
    active: client ? client.status === "active" : true,
  };
}

interface ClientFormProps {
  client?: Client;
  onSuccess: () => void;
  formId: string;
}

export function ClientForm({ client, onSuccess, formId }: ClientFormProps) {
  const isEdit = Boolean(client);
  const isClasses = useModel() === "classes";
  const user = useCurrentUser();
  const createMut = useCreateClient();
  const updateMut = useUpdateClient();
  const pending = createMut.isPending || updateMut.isPending;

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: toDefaults(client),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const payload: CreateClient = {
      organizationId: client?.organizationId ?? user.organizationId ?? ORG_ID,
      name: values.name,
      phone: values.phone,
      email: values.email || undefined,
      notes: values.notes || undefined,
      status: values.active ? "active" : "inactive",
    };

    try {
      if (isEdit && client) {
        await updateMut.mutateAsync({ id: client.id, payload });
        toast.success(
          isClasses
            ? "Aluno atualizado com sucesso."
            : "Cliente atualizado com sucesso.",
        );
      } else {
        await createMut.mutateAsync(payload);
        toast.success(
          isClasses
            ? "Aluno criado com sucesso."
            : "Cliente criado com sucesso.",
        );
      }
      onSuccess();
    } catch (error) {
      const fields = getFieldErrors(error);
      if (fields && fields.length > 0) {
        for (const f of fields) {
          form.setError(f.field as Path<ClientFormValues>, {
            message: f.message,
          });
        }
      } else {
        toast.error(
          getErrorMessage(
            error,
            isClasses
              ? "Não foi possível salvar o aluno."
              : "Não foi possível salvar o cliente.",
          ),
        );
      }
    }
  });

  return (
    <FormProvider {...form}>
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        <InputText<ClientFormValues>
          name="name"
          label={isClasses ? "Nome do aluno" : "Nome"}
          placeholder="Ex.: João Pereira"
          required
          disabled={pending}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InputPhone<ClientFormValues>
            name="phone"
            label="Telefone"
            required
            disabled={pending}
          />
          <InputText<ClientFormValues>
            name="email"
            type="email"
            label="E-mail"
            placeholder={
              isClasses
                ? "aluno@email.com (opcional)"
                : "cliente@email.com (opcional)"
            }
            disabled={pending}
          />
        </div>

        <TextArea<ClientFormValues>
          name="notes"
          label="Observações"
          placeholder="Preferências, histórico, etc. (opcional)"
          disabled={pending}
        />

        {isEdit ? (
          <SwitchField<ClientFormValues>
            name="active"
            label={isClasses ? "Aluno ativo" : "Cliente ativo"}
            hint={
              isClasses
                ? "Alunos inativos não aparecem para matrícula em novas turmas."
                : "Clientes inativos não são sugeridos em novos agendamentos."
            }
            disabled={pending}
          />
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="submit" disabled={pending}>
            {pending
              ? "Salvando..."
              : isEdit
                ? "Salvar alterações"
                : isClasses
                  ? "Cadastrar aluno"
                  : "Criar cliente"}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}
