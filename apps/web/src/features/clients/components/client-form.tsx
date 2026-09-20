"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useForm,
  FormProvider,
  useWatch,
  type Path,
  type FieldErrors,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, MapPin, Percent, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  AddressFields,
  CollapsibleSection,
  InputCurrency,
  InputNumber,
  InputPhone,
  InputText,
  SelectField,
  SwitchField,
  TextArea,
} from "@/components/form";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
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
    discountValue: client?.discount?.value ?? 0,
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
  const discountValue = useWatch({
    control: form.control,
    name: "discountValue",
  });
  const addressValues = useWatch({
    control: form.control,
    name: "address",
  });
  const notesValue = useWatch({
    control: form.control,
    name: "notes",
  });

  const [planOpen, setPlanOpen] = useState(
    () => (client ? Boolean(client.planId) : true),
  );
  const [addressOpen, setAddressOpen] = useState(
    Boolean(
      client?.address?.street ||
        client?.address?.postalCode ||
        client?.address?.city,
    ),
  );
  const [notesOpen, setNotesOpen] = useState(Boolean(client?.notes?.trim()));

  const selectedPlan = useMemo(
    () => plans?.find((p) => p.id === selectedPlanId),
    [plans, selectedPlanId],
  );

  const planBadge = selectedPlan
    ? `${selectedPlan.name} • ${formatCents(selectedPlan.priceCents)}/mês`
    : selectedPlanId
      ? "Plano selecionado"
      : undefined;

  const prevDiscountTypeRef = useRef(discountType);
  useEffect(() => {
    if (prevDiscountTypeRef.current !== discountType) {
      prevDiscountTypeRef.current = discountType;
      form.setValue("discountValue", 0);
    }
  }, [discountType, form]);

  const discountBadge = useMemo(() => {
    if (!hasDiscount || !selectedPlanId) return null;
    const numValue = Number(discountValue);
    if (!numValue || numValue <= 0 || isNaN(numValue)) {
      return null;
    }
    if (discountType === "percentage") {
      return `-${numValue}%`;
    }
    return `-${formatCents(Math.round(numValue))}`;
  }, [hasDiscount, selectedPlanId, discountValue, discountType]);

  const hasAddressData = Boolean(
    addressValues?.street?.trim() ||
      addressValues?.postalCode?.trim() ||
      addressValues?.city?.trim(),
  );
  const addressBadge = hasAddressData
    ? addressValues?.city?.trim()
      ? `${addressValues.city.trim()}${addressValues.state ? `/${addressValues.state}` : ""}`
      : "Preenchido"
    : undefined;

  const notesBadge = notesValue?.trim() ? "Preenchido" : undefined;

  const onInvalid = useCallback((errors: FieldErrors<ClientFormValues>) => {
    if (errors.address) {
      setAddressOpen(true);
    }
    if (
      errors.planId ||
      errors.dueDay ||
      errors.membershipStatus ||
      errors.discountValue ||
      errors.discountReason
    ) {
      setPlanOpen(true);
    }
    if (errors.notes) {
      setNotesOpen(true);
    }
  }, []);

  const onSubmit = async (values: ClientFormValues) => {
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
          value: Math.round(values.discountValue ?? 0),
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
          if (f.field.startsWith("address")) {
            setAddressOpen(true);
          }
          if (
            f.field === "planId" ||
            f.field === "dueDay" ||
            f.field.startsWith("discount")
          ) {
            setPlanOpen(true);
          }
          if (f.field === "notes") {
            setNotesOpen(true);
          }
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
  };

  return (
    <FormProvider {...form}>
      <form
        id={formId}
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
        noValidate
        className="flex flex-col min-h-0 flex-1 overflow-hidden"
      >
        <DialogBody className="space-y-4">
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
          <CollapsibleSection
            title="Plano & Mensalidade"
            icon={<Wallet className="h-4 w-4" />}
            badge={
              planBadge || discountBadge ? (
                <>
                  {planBadge && (
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {planBadge}
                    </span>
                  )}
                  {discountBadge && (
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {discountBadge}
                    </span>
                  )}
                </>
              ) : undefined
            }
            open={planOpen}
            onOpenChange={setPlanOpen}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className={selectedPlanId ? "sm:col-span-2" : "sm:col-span-3"}>
                  <SelectField<ClientFormValues>
                    name="planId"
                    label="Plano de acesso"
                    options={planOptions}
                    disabled={pending}
                  />
                </div>

                {selectedPlanId ? (
                  <div>
                    <InputNumber<ClientFormValues>
                      name="dueDay"
                      label="Dia do vencimento"
                      placeholder="10"
                      min={1}
                      max={31}
                      required
                      disabled={pending}
                    />
                  </div>
                ) : null}

                {selectedPlanId && isEdit ? (
                  <div className="sm:col-span-3">
                    <SelectField<ClientFormValues>
                      name="membershipStatus"
                      label="Situação da assinatura"
                      options={MEMBERSHIP_STATUS_OPTIONS}
                      disabled={pending}
                    />
                  </div>
                ) : null}
              </div>

              {selectedPlanId ? (
                <div className="pt-2 border-t border-border/40 space-y-2">
                  <div className="flex items-center justify-between py-1">
                    <label
                      htmlFor="client-has-discount"
                      className="text-xs font-medium text-foreground flex items-center gap-2 cursor-pointer select-none"
                    >
                      <Percent className="size-3.5 text-muted-foreground" />
                      <span>Conceder desconto na mensalidade</span>
                    </label>
                    <Switch
                      id="client-has-discount"
                      checked={Boolean(hasDiscount)}
                      onCheckedChange={(checked) =>
                        form.setValue("hasDiscount", checked, { shouldDirty: true })
                      }
                      disabled={pending}
                    />
                  </div>

                  {hasDiscount ? (
                    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3 animate-in fade-in-50 duration-150">
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
                            label="Desconto (%)"
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
                        placeholder="Ex: Desconto família, atleta ou bolsa"
                        disabled={pending}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </CollapsibleSection>
        ) : null}

        {/* Bloco 3: Endereço Estruturado (Opcional) */}
        <CollapsibleSection
          title="Endereço (opcional)"
          icon={<MapPin className="h-4 w-4" />}
          badge={addressBadge}
          open={addressOpen}
          onOpenChange={setAddressOpen}
        >
          <AddressFields<ClientFormValues>
            prefix="address"
            disabled={pending}
          />
        </CollapsibleSection>

        {/* Bloco 4: Observações e restrições (Opcional) */}
        <CollapsibleSection
          title="Observações e restrições (opcional)"
          icon={<FileText className="h-4 w-4" />}
          badge={notesBadge}
          open={notesOpen}
          onOpenChange={setNotesOpen}
        >
          <TextArea<ClientFormValues>
            name="notes"
            placeholder="Histórico, restrições médicas, preferências, etc. (opcional)"
            disabled={pending}
          />
        </CollapsibleSection>

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
        </DialogBody>

        <DialogFooter className="p-6 pt-4 border-t border-border/40 shrink-0 bg-background">
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

