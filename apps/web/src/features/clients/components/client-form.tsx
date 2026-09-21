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
import { CalendarClock, FileText, MapPin, Percent, SlidersHorizontal, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  AddressFields,
  CollapsibleSection,
  DateField,
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
import type { Address, Client, CreateClient, OrganizationSettings } from "@gestarahub/contracts";
import { useCurrentUser, useModel } from "@/features/auth";
import { usePlans } from "@/features/turmas";
import { useOrganization } from "@/features/settings";
import { useCreateClient, useUpdateClient } from "../hooks/use-clients";
import { clientFormSchema, type ClientFormValues } from "../client-schema";
import { addDays, addMonths, format, parseISO } from "date-fns";

const MEMBERSHIP_STATUS_OPTIONS = [
  { value: "active", label: "Ativa (treinando normalmente)" },
  { value: "paused", label: "Trancada / Pausada (não gera cobrança)" },
  { value: "canceled", label: "Cancelada (desistente/saída)" },
];

const DISCOUNT_TYPE_OPTIONS = [
  { value: "fixed", label: "Valor fixo em reais (R$)" },
  { value: "percentage", label: "Porcentagem sobre a mensalidade (%)" },
];

const todayDateISO = format(new Date(), "yyyy-MM-dd");

function computeBillingCalculation({
  plan,
  planStartDate,
  basePriceCents,
  defaultDueDay = 10,
}: {
  plan?: { period?: string; priceCents: number };
  planStartDate?: string;
  basePriceCents: number;
  defaultDueDay?: number;
}) {
  if (!plan) return null;

  const dateStr = planStartDate || todayDateISO;
  const parsedDate = parseISO(dateStr);
  const validDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const year = validDate.getFullYear();
  const month = validDate.getMonth() + 1;
  const day = validDate.getDate();

  const daysInMonth = new Date(year, month, 0).getDate();
  const period = plan.period || "monthly";

  let remainingDays = Math.max(1, daysInMonth - day + 1);
  let totalPeriodDays = daysInMonth;
  let periodLabel = "mês";
  let nextCycleDateISO = "";

  if (period === "weekly") {
    totalPeriodDays = 7;
    remainingDays = Math.max(1, 7 - ((day - 1) % 7));
    periodLabel = "semana";
    nextCycleDateISO = format(addDays(validDate, 7), "yyyy-MM-dd");
  } else if (period === "biweekly") {
    totalPeriodDays = 15;
    if (day <= 15) {
      remainingDays = Math.max(1, 15 - day + 1);
    } else {
      totalPeriodDays = Math.max(1, daysInMonth - 15);
      remainingDays = Math.max(1, daysInMonth - day + 1);
    }
    periodLabel = "quinzena";
    nextCycleDateISO = format(addDays(validDate, 15), "yyyy-MM-dd");
  } else {
    // monthly
    totalPeriodDays = daysInMonth;
    remainingDays = Math.max(1, daysInMonth - day + 1);
    periodLabel = "mês";
    nextCycleDateISO = format(addMonths(validDate, 1), "yyyy-MM-dd");
  }

  // Próximo vencimento padrão da academia (usado no modo proporcional pós-pago)
  let nextStandardDueDate = new Date(year, month - 1, Math.min(defaultDueDay, daysInMonth));
  if (nextStandardDueDate <= validDate) {
    const nextM = addMonths(validDate, 1);
    const daysInNextM = new Date(nextM.getFullYear(), nextM.getMonth() + 1, 0).getDate();
    nextStandardDueDate = new Date(nextM.getFullYear(), nextM.getMonth(), Math.min(defaultDueDay, daysInNextM));
  }
  const nextStandardDueDateISO = format(nextStandardDueDate, "yyyy-MM-dd");

  const isFirstDay = day === 1;
  const proratedAmountCents = Math.round((basePriceCents / totalPeriodDays) * remainingDays);

  return {
    day,
    month,
    year,
    daysInMonth,
    remainingDays,
    totalPeriodDays,
    periodLabel,
    isFirstDay,
    proratedAmountCents,
    fullAmountCents: basePriceCents,
    nextCycleDateISO,
    nextStandardDueDateISO,
    startDateISO: dateStr,
  };
}

function toDefaults(client?: Client, orgSettings?: OrganizationSettings): ClientFormValues {
  const addr = client?.address;
  const hasDiscount = Boolean(client?.discount && client.discount.value > 0);
  const initialStartDate = client?.planStartDate || todayDateISO;
  const initialStrategy = client?.billingStrategy || orgSettings?.midMonthStrategy || "prorated";
  const initialTiming = client?.cyclePaymentTiming || orgSettings?.billingTiming || "prepaid";
  const defaultDueDay = client?.dueDay ?? orgSettings?.defaultDueDay ?? 10;

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
    planStartDate: initialStartDate,
    billingStrategy: initialStrategy,
    cyclePaymentTiming: initialTiming,
    firstChargeAmount: undefined,
    firstChargeDueDate: initialStartDate,
    dueDay: defaultDueDay,
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
  const orgSettings = orgQuery.data?.settings;
  const defaultDueDay = orgSettings?.defaultDueDay ?? 10;
  const orgBillingTiming = orgSettings?.billingTiming ?? "prepaid";

  const [showAdvancedBilling, setShowAdvancedBilling] = useState(false);

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
    defaultValues: toDefaults(client, orgSettings),
  });

  const selectedPlanId = useWatch({
    control: form.control,
    name: "planId",
  });
  const planStartDate = useWatch({
    control: form.control,
    name: "planStartDate",
  });
  const billingStrategy = useWatch({
    control: form.control,
    name: "billingStrategy",
  });
  const cyclePaymentTiming = useWatch({
    control: form.control,
    name: "cyclePaymentTiming",
  });
  const dueDayValue = useWatch({
    control: form.control,
    name: "dueDay",
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
  const firstChargeAmount = useWatch({
    control: form.control,
    name: "firstChargeAmount",
  });

  // Se o form montou antes do orgSettings resolver do backend/cache:
  const orgSettingsLoadedRef = useRef(false);
  useEffect(() => {
    if (orgSettings && !orgSettingsLoadedRef.current && !client) {
      orgSettingsLoadedRef.current = true;
      if (orgSettings.midMonthStrategy) {
        form.setValue("billingStrategy", orgSettings.midMonthStrategy);
      }
      if (orgSettings.billingTiming) {
        form.setValue("cyclePaymentTiming", orgSettings.billingTiming);
      }
      if (orgSettings.defaultDueDay) {
        form.setValue("dueDay", orgSettings.defaultDueDay);
      }
    }
  }, [orgSettings, client, form]);

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

  const basePriceCents = useMemo(() => {
    if (!selectedPlan) return 0;
    let price = selectedPlan.priceCents;
    if (hasDiscount && discountValue && Number(discountValue) > 0) {
      if (discountType === "percentage") {
        const disc = Math.round((price * Number(discountValue)) / 100);
        price = Math.max(0, price - disc);
      } else {
        price = Math.max(0, price - Math.round(Number(discountValue)));
      }
    }
    return price;
  }, [selectedPlan, hasDiscount, discountType, discountValue]);

  const billingCalculation = useMemo(() => {
    return computeBillingCalculation({
      plan: selectedPlan,
      planStartDate,
      basePriceCents,
      defaultDueDay,
    });
  }, [selectedPlan, planStartDate, basePriceCents, defaultDueDay]);

  const prevDateRef = useRef(planStartDate);
  const prevPlanRef = useRef(selectedPlanId);
  const prevStrategyRef = useRef(billingStrategy);
  const prevTimingRef = useRef(cyclePaymentTiming);
  const prevPriceRef = useRef(basePriceCents);

  useEffect(() => {
    const dateChanged = prevDateRef.current !== planStartDate;
    const planChanged = prevPlanRef.current !== selectedPlanId;
    const strategyChanged = prevStrategyRef.current !== billingStrategy;
    const timingChanged = prevTimingRef.current !== cyclePaymentTiming;
    const priceChanged = prevPriceRef.current !== basePriceCents;
    const isUninitialized = Boolean(selectedPlanId && billingCalculation && firstChargeAmount === undefined);

    prevDateRef.current = planStartDate;
    prevPlanRef.current = selectedPlanId;
    prevStrategyRef.current = billingStrategy;
    prevTimingRef.current = cyclePaymentTiming;
    prevPriceRef.current = basePriceCents;

    if (
      (dateChanged || planChanged || strategyChanged || timingChanged || priceChanged || isUninitialized) &&
      billingCalculation
    ) {
      if (billingStrategy === "full_cycle") {
        form.setValue("dueDay", billingCalculation.day, { shouldDirty: true });
        form.setValue("firstChargeAmount", billingCalculation.fullAmountCents, { shouldDirty: true });
        const targetDueDate =
          (cyclePaymentTiming ?? orgBillingTiming) === "postpaid"
            ? billingCalculation.nextCycleDateISO
            : billingCalculation.startDateISO;
        form.setValue("firstChargeDueDate", targetDueDate, { shouldDirty: true });
      } else {
        form.setValue("dueDay", defaultDueDay, { shouldDirty: true });
        form.setValue("firstChargeAmount", billingCalculation.proratedAmountCents, { shouldDirty: true });
        const targetDueDate =
          (cyclePaymentTiming ?? orgBillingTiming) === "postpaid"
            ? billingCalculation.nextStandardDueDateISO
            : billingCalculation.startDateISO;
        form.setValue("firstChargeDueDate", targetDueDate, { shouldDirty: true });
      }
    }
  }, [
    planStartDate,
    selectedPlanId,
    billingStrategy,
    cyclePaymentTiming,
    basePriceCents,
    billingCalculation,
    defaultDueDay,
    orgBillingTiming,
    form,
    firstChargeAmount,
  ]);

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
      errors.planStartDate ||
      errors.billingStrategy ||
      errors.firstChargeAmount ||
      errors.firstChargeDueDate ||
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

    const isNewPlanAssignment = Boolean(values.planId && (!isEdit || !client?.planId));
    let initialChargePayload: CreateClient["initialCharge"] | undefined;

    if (isNewPlanAssignment && billingCalculation) {
      const isProrated = values.billingStrategy === "prorated";
      const chosenAmount =
        values.firstChargeAmount !== undefined && values.firstChargeAmount !== null
          ? Math.round(values.firstChargeAmount)
          : isProrated
            ? billingCalculation.proratedAmountCents
            : billingCalculation.fullAmountCents;

      if (chosenAmount > 0) {
        initialChargePayload = {
          amountCents: chosenAmount,
          dueDate: values.firstChargeDueDate || values.planStartDate || todayDateISO,
          isProrated,
          proratedDays: isProrated ? billingCalculation.remainingDays : undefined,
        };
      }
    }

    const payload: CreateClient = {
      organizationId: client?.organizationId ?? user.organizationId ?? ORG_ID,
      name: values.name,
      phone: values.phone,
      email: values.email || undefined,
      notes: values.notes || undefined,
      address: addressPayload,
      planId: values.planId || undefined,
      planStartDate: values.planId ? values.planStartDate || todayDateISO : undefined,
      billingStrategy: values.planId ? values.billingStrategy || "prorated" : undefined,
      cyclePaymentTiming:
        values.planId && values.billingStrategy === "full_cycle"
          ? values.cyclePaymentTiming || "postpaid"
          : undefined,
      dueDay: values.planId ? values.dueDay || defaultDueDay : undefined,
      membershipStatus: values.planId ? values.membershipStatus || "active" : undefined,
      discount: values.planId ? discountPayload : undefined,
      status: values.active ? "active" : "inactive",
      initialCharge: initialChargePayload,
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
            f.field === "planStartDate" ||
            f.field === "billingStrategy" ||
            f.field === "firstChargeAmount" ||
            f.field === "firstChargeDueDate" ||
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
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SelectField<ClientFormValues>
                  name="planId"
                  label="Plano de acesso"
                  options={planOptions}
                  disabled={pending}
                />

                {selectedPlanId ? (
                  <DateField<ClientFormValues>
                    name="planStartDate"
                    label="Data de início do plano"
                    hint="Data a partir de quando o plano entra em vigor."
                    disabled={pending}
                  />
                ) : null}
              </div>

              {selectedPlanId && (!isEdit || !client?.planId) ? (
                <div className="space-y-3 pt-2 border-t border-border/40 animate-in fade-in-50 duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <CalendarClock className="size-3.5 text-primary" />
                      Cobrança da 1ª mensalidade
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">
                      Padrão da academia: {billingStrategy === "prorated" ? "Proporcional" : "Ciclo 30d"} •{" "}
                      {cyclePaymentTiming === "postpaid" ? "Pós-pago" : "Pré-pago"}
                    </span>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-muted/20 p-3.5 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <InputCurrency<ClientFormValues>
                        name="firstChargeAmount"
                        label="Valor da 1ª cobrança"
                        placeholder={
                          billingCalculation
                            ? (
                                (billingStrategy === "full_cycle"
                                  ? billingCalculation.fullAmountCents
                                  : billingCalculation.proratedAmountCents) / 100
                              ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
                            : "0,00"
                        }
                        disabled={pending}
                        hint={
                          billingStrategy === "prorated"
                            ? `Calculado automaticamente para os ${billingCalculation?.remainingDays ?? 0} dias restantes no mês.`
                            : "Valor integral do primeiro ciclo de 30 dias."
                        }
                      />
                      <DateField<ClientFormValues>
                        name="firstChargeDueDate"
                        label="Vencimento da 1ª cobrança"
                        disabled={pending}
                        hint={
                          cyclePaymentTiming === "postpaid"
                            ? "Vence ao término do período (Pós-pago)."
                            : "Vence no ato da matrícula (Pré-pago)."
                        }
                      />
                    </div>

                    {/* Rodapé explicativo e link sutil para personalização opcional */}
                    <div className="pt-2 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <p className="text-[11px] text-muted-foreground">
                        {billingStrategy === "prorated"
                          ? `Próximas mensalidades vencerão todo dia ${dueDayValue ?? defaultDueDay}.`
                          : `Próximas mensalidades vencerão todo dia ${dueDayValue ?? defaultDueDay} a cada 30 dias.`}
                      </p>

                      <button
                        type="button"
                        onClick={() => setShowAdvancedBilling((prev) => !prev)}
                        className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                      >
                        <SlidersHorizontal className="size-3" />
                        {showAdvancedBilling ? "Ocultar ajustes" : "Personalizar regra deste aluno"}
                      </button>
                    </div>

                    {showAdvancedBilling ? (
                      <div className="space-y-3 pt-3 border-t border-border/40 animate-in fade-in-50 duration-150">
                        <span className="text-xs font-semibold text-foreground block">
                          Sobrescrever regra da academia apenas para este aluno:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <SelectField<ClientFormValues>
                            name="billingStrategy"
                            label="Cálculo da entrada"
                            options={[
                              { value: "prorated", label: "Cobrar proporcional (Pró-rata)" },
                              { value: "full_cycle", label: "Ciclo corrido (30 dias)" },
                            ]}
                            disabled={pending}
                          />
                          <SelectField<ClientFormValues>
                            name="cyclePaymentTiming"
                            label="Momento do pagamento"
                            options={[
                              { value: "prepaid", label: "No ato da matrícula (Pré-pago)" },
                              { value: "postpaid", label: "Ao final do ciclo (Pós-pago)" },
                            ]}
                            disabled={pending}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {selectedPlanId ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InputNumber<ClientFormValues>
                    name="dueDay"
                    label="Dia do vencimento recorrente"
                    placeholder="10"
                    min={1}
                    max={31}
                    required
                    disabled={pending}
                    hint={
                      billingStrategy === "full_cycle"
                        ? "Ajustado para o dia de início do plano."
                        : `Dia do mês para os próximos ciclos de cobrança (padrão: ${defaultDueDay}).`
                    }
                  />

                  {isEdit ? (
                    <SelectField<ClientFormValues>
                      name="membershipStatus"
                      label="Situação da assinatura"
                      options={MEMBERSHIP_STATUS_OPTIONS}
                      disabled={pending}
                    />
                  ) : null}
                </div>
              ) : null}

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

