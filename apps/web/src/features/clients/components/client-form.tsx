"use client";

import { useMemo, useState } from "react";
import { useForm, FormProvider, useWatch, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, MapPin, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  AddressFields,
  InputCurrency,
  InputNumber,
  InputPhone,
  InputText,
  SelectField,
  SwitchField,
  TextArea,
} from "@/components/form";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import { formatCents } from "@gestarahub/core/format";
import { ORG_ID } from "@/config/tenant";
import type { Address, Client, CreateClient } from "@gestarahub/contracts";
import { useCurrentUser, useModel } from "@/features/auth";
import { usePlans } from "@/features/turmas";
import { useOrganization } from "@/features/settings";
import { useCreateClient, useUpdateClient } from "../hooks/use-clients";
import { clientFormSchema, type ClientFormValues } from "../client-schema";

const MEMBERSHIP_STATUS_OPTIONS = [
  { value: "active", label: "Ativa (treinando normalmente)" },
  { value: "paused", label: "Trancada / Pausada (não gera cobrança)" },
  { value: "canceled", label: "Cancelada (desistente/saída)" },
];

const DISCOUNT_TYPE_OPTIONS = [
  { value: "fixed", label: "Valor fixo em reais (R$)" },
  { value: "percentage", label: "Porcentagem sobre a mensalidade (%)" },
];

function toDefaults(client?: Client, defaultDueDay: number = 10): ClientFormValues {
  const addr = client?.address;
  const hasDiscount = Boolean(client?.discount && client.discount.value > 0);
  return {
    name: client?.name ?? "",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    notes: client?.notes ?? "",
    active: client ? client.status === "active" : true,
    address: {
      postalCode: addr?.postalCode ?? "",
      street: addr?.street ?? "",
      number: addr?.number ?? "",
      complement: addr?.complement ?? "",
      neighborhood: addr?.neighborhood ?? "",
      city: addr?.city ?? "",
      state: addr?.state ?? "",
    },
    planId: client?.planId ?? "",
    dueDay: client?.dueDay ?? defaultDueDay,
    membershipStatus: client?.membershipStatus ?? "active",
    hasDiscount,
    discountType: client?.discount?.type ?? "fixed",
    discountValue: client?.discount
      ? client.discount.type === "fixed"
        ? client.discount.value / 100
        : client.discount.value
      : 0,
    discountReason: client?.discount?.reason ?? "",
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

  const orgQuery = useOrganization();
  const defaultDueDay = orgQuery.data?.settings?.defaultDueDay ?? 10;

  const { data: plans } = usePlans({ status: "active" });

  const planOptions = useMemo(() => {
    const list = (plans ?? []).map((p) => ({
      value: p.id,
      label: `${p.name} — ${formatCents(p.priceCents)}/mês`,
    }));
    return [{ value: "", label: "Nenhum plano (sem mensalidade fixa)" }, ...list];
  }, [plans]);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: toDefaults(client, defaultDueDay),
  });

  const selectedPlanId = useWatch({
    control: form.control,
    name: "planId",
  });
  const hasDiscount = useWatch({
    control: form.control,
    name: "hasDiscount",
  });
  const discountType = useWatch({
    control: form.control,
    name: "discountType",
  });

  const [addressOpen, setAddressOpen] = useState(
    Boolean(
      client?.address?.street ||
        client?.address?.postalCode ||
        client?.address?.city,
    ),
  );

  const onSubmit = form.handleSubmit(async (values) => {
    const hasAddr =
      values.address &&
      (Boolean(values.address.street) ||
        Boolean(values.address.postalCode) ||
        Boolean(values.address.city));

    const addressPayload: Address | undefined = hasAddr
      ? {
          postalCode: values.address?.postalCode || "",
          street: values.address?.street || "",
          number: values.address?.number || "",
          complement: values.address?.complement || undefined,
          neighborhood: values.address?.neighborhood || "",
          city: values.address?.city || "",
          state: values.address?.state || "",
        }
      : undefined;

    const hasDiscountVal =
      Boolean(values.hasDiscount &&
      values.discountValue !== undefined &&
      values.discountValue !== null &&
      values.discountValue > 0);

    const discountPayload = hasDiscountVal
      ? {
          type: values.discountType ?? "fixed",
          value:
            values.discountType === "fixed"
              ? Math.round((values.discountValue ?? 0) * 100)
              : Math.round(values.discountValue ?? 0),
          reason: values.discountReason?.trim() || undefined,
        }
      : undefined;

    const payload: CreateClient = {
      organizationId: client?.organizationId ?? user.organizationId ?? ORG_ID,
      name: values.name,
      phone: values.phone,
      email: values.email || undefined,
      notes: values.notes || undefined,
      address: addressPayload,
      planId: values.planId || undefined,
      dueDay: values.planId ? values.dueDay || defaultDueDay : undefined,
      membershipStatus: values.planId ? values.membershipStatus || "active" : undefined,
      discount: values.planId ? discountPayload : undefined,
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
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-5">
        {/* Bloco 1: Dados de Identificação */}
        <div className="space-y-4">
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
              label="Telefone (WhatsApp)"
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
        </div>

        {/* Bloco 2: Plano & Mensalidade (específico de classes/academia) */}
        {isClasses ? (
          <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Wallet className="h-4 w-4 text-primary" />
              <span>Plano & Mensalidade</span>
            </div>

            <SelectField<ClientFormValues>
              name="planId"
              label="Plano de Acesso"
              hint="O plano determina o valor cobrado mensalmente do aluno."
              options={planOptions}
              disabled={pending}
            />

            {selectedPlanId ? (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <InputNumber<ClientFormValues>
                    name="dueDay"
                    label="Dia de vencimento da mensalidade"
                    hint="Dia do mês (1 a 31) para a cobrança."
                    min={1}
                    max={31}
                    required
                    disabled={pending}
                  />

                  <SelectField<ClientFormValues>
                    name="membershipStatus"
                    label="Situação da assinatura"
                    options={MEMBERSHIP_STATUS_OPTIONS}
                    disabled={pending}
                  />
                </div>

                {/* Desconto Opcional */}
                <div className="pt-2 border-t space-y-3">
                  <SwitchField<ClientFormValues>
                    name="hasDiscount"
                    label="Conceder desconto nesta mensalidade"
                    hint="Útil para desconto família, bolsista ou atleta."
                    disabled={pending}
                  />

                  {hasDiscount ? (
                    <div className="space-y-3 pl-2 border-l-2 border-primary/40 pt-1">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <SelectField<ClientFormValues>
                          name="discountType"
                          label="Tipo de desconto"
                          options={DISCOUNT_TYPE_OPTIONS}
                          disabled={pending}
                        />
                        {discountType === "percentage" ? (
                          <InputNumber<ClientFormValues>
                            name="discountValue"
                            label="Porcentagem de desconto (%)"
                            placeholder="Ex: 10"
                            min={0}
                            max={100}
                            disabled={pending}
                          />
                        ) : (
                          <InputCurrency<ClientFormValues>
                            name="discountValue"
                            label="Valor do desconto (R$)"
                            placeholder="0,00"
                            disabled={pending}
                          />
                        )}
                      </div>
                      <InputText<ClientFormValues>
                        name="discountReason"
                        label="Motivo do desconto"
                        placeholder="Ex: Desconto família (irmãos treinando juntos)"
                        disabled={pending}
                      />
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {/* Bloco 3: Endereço Estruturado (Opcional) */}
        <div className="rounded-lg border p-3 space-y-3">
          <button
            type="button"
            className="flex w-full items-center justify-between text-sm font-medium text-foreground hover:text-primary transition-colors"
            onClick={() => setAddressOpen(!addressOpen)}
          >
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>Endereço (opcional)</span>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                addressOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {addressOpen ? (
            <div className="pt-2 border-t">
              <AddressFields<ClientFormValues>
                prefix="address"
                disabled={pending}
              />
            </div>
          ) : null}
        </div>

        {/* Observações e Ativo */}
        <TextArea<ClientFormValues>
          name="notes"
          label="Observações"
          placeholder="Histórico, restrições médicas, preferências, etc. (opcional)"
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

