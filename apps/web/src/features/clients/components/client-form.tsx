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
import { CalendarClock, FileText, MapPin, Percent, Wallet } from "lucide-react";
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
import type { Address, Client, CreateClient } from "@gestarahub/contracts";
import { useCurrentUser, useModel } from "@/features/auth";
import { usePlans } from "@/features/turmas";
import { useOrganization } from "@/features/settings";
import { useCreateClient, useUpdateClient } from "../hooks/use-clients";
import { clientFormSchema, type ClientFormValues } from "../client-schema";
import { addDays, addMonths, format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

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
}: {
  plan?: { period?: string; priceCents: number };
  planStartDate?: string;
  basePriceCents: number;
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
    startDateISO: dateStr,
  };
}

function toDefaults(client?: Client, defaultDueDay: number = 10): ClientFormValues {
  const addr = client?.address;
  const hasDiscount = Boolean(client?.discount && client.discount.value > 0);
  const initialStartDate = client?.planStartDate || todayDateISO;
  const initialStrategy = client?.billingStrategy || "prorated";
  const initialTiming = client?.cyclePaymentTiming || "postpaid";

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
    });
  }, [selectedPlan, planStartDate, basePriceCents]);

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
          (cyclePaymentTiming ?? "postpaid") === "postpaid"
            ? billingCalculation.nextCycleDateISO
            : billingCalculation.startDateISO;
        form.setValue("firstChargeDueDate", targetDueDate, { shouldDirty: true });
      } else {
        form.setValue("firstChargeAmount", billingCalculation.proratedAmountCents, { shouldDirty: true });
        form.setValue("firstChargeDueDate", billingCalculation.startDateISO, { shouldDirty: true });
      }
    }
  }, [planStartDate, selectedPlanId, billingStrategy, cyclePaymentTiming, basePriceCents, billingCalculation, form, firstChargeAmount]);

  const handleSelectStrategy = useCallback((strategy: "prorated" | "full_cycle") => {
    form.setValue("billingStrategy", strategy, { shouldDirty: true });
    if (!billingCalculation) return;

    if (strategy === "prorated") {
      form.setValue("dueDay", defaultDueDay, { shouldDirty: true });
      form.setValue("firstChargeAmount", billingCalculation.proratedAmountCents, { shouldDirty: true });
      form.setValue("firstChargeDueDate", billingCalculation.startDateISO, { shouldDirty: true });
    } else {
      form.setValue("dueDay", billingCalculation.day, { shouldDirty: true });
      form.setValue("firstChargeAmount", billingCalculation.fullAmountCents, { shouldDirty: true });
      const targetDueDate =
        (form.getValues("cyclePaymentTiming") ?? "postpaid") === "postpaid"
          ? billingCalculation.nextCycleDateISO
          : billingCalculation.startDateISO;
      form.setValue("firstChargeDueDate", targetDueDate, { shouldDirty: true });
    }
  }, [billingCalculation, defaultDueDay, form]);

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
                    {billingCalculation && !billingCalculation.isFirstDay ? (
                      <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        Início no meio do {billingCalculation.periodLabel}
                      </span>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {/* Opção 1: Pró-rata */}
                    <button
                      type="button"
                      onClick={() => handleSelectStrategy("prorated")}
                      className={cn(
                        "flex flex-col items-start p-3 rounded-lg border text-left transition-all relative select-none cursor-pointer",
                        billingStrategy === "prorated"
                          ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                          : "border-border/60 hover:border-border hover:bg-muted/30",
                      )}
                      disabled={pending}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-xs font-semibold text-foreground">
                          Cobrar proporcional
                        </span>
                        <span className="text-xs font-bold text-primary">
                          {formatCents(billingCalculation?.proratedAmountCents ?? basePriceCents)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {billingCalculation
                          ? `${billingCalculation.remainingDays} dias restantes no ${billingCalculation.periodLabel}. Mantém vencimento no dia padrão (${defaultDueDay}).`
                          : "Calcula apenas os dias restantes do período atual."}
                      </p>
                    </button>

                    {/* Opção 2: Ciclo Completo */}
                    <button
                      type="button"
                      onClick={() => handleSelectStrategy("full_cycle")}
                      className={cn(
                        "flex flex-col items-start p-3 rounded-lg border text-left transition-all relative select-none cursor-pointer",
                        billingStrategy === "full_cycle"
                          ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                          : "border-border/60 hover:border-border hover:bg-muted/30",
                      )}
                      disabled={pending}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-xs font-semibold text-foreground">
                          Ciclo completo ({billingCalculation?.periodLabel ?? "mês"})
                        </span>
                        <span className="text-xs font-bold text-primary">
                          {formatCents(billingCalculation?.fullAmountCents ?? basePriceCents)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {billingCalculation
                          ? `Vencimento fixado no dia de início (dia ${billingCalculation.day}). Ciclo a partir da matrícula.`
                          : "Cobra o valor integral com ciclo a partir da data de início."}
                      </p>
                    </button>
                  </div>

                  {billingStrategy === "full_cycle" ? (
                    <div className="space-y-1.5 p-3 rounded-lg border border-border/60 bg-muted/20 animate-in fade-in-50 duration-150">
                      <span className="text-xs font-medium text-foreground block">
                        Momento do 1º pagamento:
                      </span>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => {
                            form.setValue("cyclePaymentTiming", "postpaid", { shouldDirty: true });
                            if (billingCalculation) {
                              form.setValue("firstChargeDueDate", billingCalculation.nextCycleDateISO, { shouldDirty: true });
                            }
                          }}
                          className={cn(
                            "flex flex-col items-start p-2.5 rounded-md border text-left transition-all select-none cursor-pointer",
                            (cyclePaymentTiming ?? "postpaid") === "postpaid"
                              ? "border-primary bg-primary/10 text-foreground font-medium ring-1 ring-primary/40 shadow-2xs"
                              : "border-border/50 hover:bg-muted/40 text-muted-foreground",
                          )}
                          disabled={pending}
                        >
                          <div className="flex items-center gap-1.5 text-xs">
                            <span
                              className={cn(
                                "size-2 rounded-full shrink-0",
                                (cyclePaymentTiming ?? "postpaid") === "postpaid"
                                  ? "bg-primary"
                                  : "bg-muted-foreground/30",
                              )}
                            />
                            <span className="font-semibold text-foreground">
                              Ao final do ciclo (Pós-pago)
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 pl-3.5 leading-snug">
                            Vence em{" "}
                            <span className="font-medium text-foreground">
                              {billingCalculation ? format(parseISO(billingCalculation.nextCycleDateISO), "dd/MM/yyyy") : ""}
                            </span>{" "}
                            após cursar as aulas.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            form.setValue("cyclePaymentTiming", "prepaid", { shouldDirty: true });
                            if (billingCalculation) {
                              form.setValue("firstChargeDueDate", billingCalculation.startDateISO, { shouldDirty: true });
                            }
                          }}
                          className={cn(
                            "flex flex-col items-start p-2.5 rounded-md border text-left transition-all select-none cursor-pointer",
                            cyclePaymentTiming === "prepaid"
                              ? "border-primary bg-primary/10 text-foreground font-medium ring-1 ring-primary/40 shadow-2xs"
                              : "border-border/50 hover:bg-muted/40 text-muted-foreground",
                          )}
                          disabled={pending}
                        >
                          <div className="flex items-center gap-1.5 text-xs">
                            <span
                              className={cn(
                                "size-2 rounded-full shrink-0",
                                cyclePaymentTiming === "prepaid"
                                  ? "bg-primary"
                                  : "bg-muted-foreground/30",
                              )}
                            />
                            <span className="font-semibold text-foreground">
                              No ato da matrícula (Pré-pago)
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 pl-3.5 leading-snug">
                            Vence em{" "}
                            <span className="font-medium text-foreground">
                              {billingCalculation ? format(parseISO(billingCalculation.startDateISO), "dd/MM/yyyy") : ""}
                            </span>{" "}
                            para liberar o acesso.
                          </p>
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-lg border border-border/50 bg-muted/20 p-3">
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
                          ? "Valor proporcional sugerido (editável para ajuste ou cortesia)."
                          : "Valor integral do primeiro ciclo."
                      }
                    />
                    <DateField<ClientFormValues>
                      name="firstChargeDueDate"
                      label="Vencimento da 1ª cobrança"
                      disabled={pending}
                      hint="Data de vencimento para o primeiro pagamento."
                    />
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

