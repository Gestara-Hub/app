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
  ComboboxField,
  DateField,
  InputCurrency,
  InputNumber,
  InputPhone,
  InputText,
  SelectField,
  TextArea,
} from "@/components/form";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import { formatCents } from "@gestarahub/core/format";
import type { Address, Client, CreateClient, OrganizationSettings, PlanPeriod } from "@gestarahub/contracts";
import { useModel } from "@/features/auth";
import { usePlans } from "@/features/turmas";
import { useOrganization } from "@/features/settings";
import { useCreateClient, useUpdateClient } from "../hooks/use-clients";
import { clientFormSchema, type ClientFormValues } from "../client-schema";
import { format } from "date-fns";
import { resolveMembershipTerms, upcomingCharges } from "@gestarahub/core/billing";

const MEMBERSHIP_STATUS_OPTIONS = [
  { value: "active", label: "Ativa (treinando normalmente)" },
  { value: "paused", label: "Trancada / Pausada (não gera cobrança)" },
  { value: "canceled", label: "Cancelada (desistente/saída)" },
];

const PERIOD_SUFFIX: Record<PlanPeriod, string> = {
  monthly: "mês",
  biweekly: "quinzena",
  weekly: "semana",
};

const STRATEGY_LABEL = { prorated: "Proporcional", full_cycle: "Mês cheio" } as const;
const TIMING_LABEL = { prepaid: "Antecipado", postpaid: "Depois do uso" } as const;

const shortDate = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

const DISCOUNT_TYPE_OPTIONS = [
  { value: "fixed", label: "Valor fixo em reais (R$)" },
  { value: "percentage", label: "Porcentagem sobre a mensalidade (%)" },
];

const todayDateISO = format(new Date(), "yyyy-MM-dd");

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
  /** Avisa o diálogo se há alterações não salvas (para confirmar o descarte). */
  onDirtyChange?: (dirty: boolean) => void;
}

export function ClientForm({ client, onSuccess, formId, onDirtyChange }: ClientFormProps) {
  const isEdit = Boolean(client);
  const isClasses = useModel() === "classes";
  const createMut = useCreateClient();
  const updateMut = useUpdateClient();
  const pending = createMut.isPending || updateMut.isPending;

  const orgQuery = useOrganization();
  const orgSettings = orgQuery.data?.settings;
  const defaultDueDay = orgSettings?.defaultDueDay ?? 10;

  const [showAdvancedBilling, setShowAdvancedBilling] = useState(false);

  const { data: plans } = usePlans({ status: "active" });

  const planOptions = useMemo(() => {
    const list = (plans ?? []).map((p) => {
      const cleanName = p.name
        .replace(/^(Mensal|Quinzenal|Semanal)\s*[-–—:]\s*/i, "")
        .trim();
      return {
        value: p.id,
        label: `${cleanName} — ${formatCents(p.priceCents)}/${PERIOD_SUFFIX[p.period ?? "monthly"]}`,
      };
    });
    return [{ value: "", label: "Nenhum plano (sem mensalidade fixa)" }, ...list];
  }, [plans]);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: toDefaults(client, orgSettings),
  });

  const isDirty = form.formState.isDirty;
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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

  const [planOpen, setPlanOpen] = useState(() => !client);
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
    ? `${selectedPlan.name.replace(/^(Mensal|Quinzenal|Semanal)\s*[-–—:]\s*/i, "").trim()} • ${formatCents(selectedPlan.priceCents)}/${PERIOD_SUFFIX[selectedPlan.period ?? "monthly"]}`
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

  // Mesmo motor da geracao em lote e da previa das Configuracoes.
  const billingCalculation = useMemo(() => {
    if (!selectedPlan) return null;
    const terms = resolveMembershipTerms(
      {
        period: selectedPlan.period,
        planPriceCents: basePriceCents,
        startDate: planStartDate || todayDateISO,
        strategy: billingStrategy,
        timing: cyclePaymentTiming,
        dueDay: billingStrategy === "full_cycle" ? undefined : defaultDueDay,
      },
      orgSettings,
    );
    const [first, next] = upcomingCharges(terms, 2);
    return { terms, first, next };
  }, [selectedPlan, basePriceCents, planStartDate, billingStrategy, cyclePaymentTiming, defaultDueDay, orgSettings]);

  // A 1a cobranca aparece no cadastro e quando o aluno troca de plano.
  const showFirstCharge = Boolean(selectedPlanId && (!isEdit || selectedPlanId !== client?.planId));
  const usesOrgRule =
    billingStrategy === (orgSettings?.midMonthStrategy ?? "prorated") &&
    cyclePaymentTiming === (orgSettings?.billingTiming ?? "prepaid");
  const periodNoun = { monthly: "do mês", biweekly: "da quinzena", weekly: "da semana" }[
    selectedPlan?.period ?? "monthly"
  ];
  const firstChargeHint = billingCalculation?.first.isProrated
    ? `Proporcional aos ${billingCalculation.first.proratedDays} dias restantes ${periodNoun}.`
    : `Valor cheio do primeiro período (${periodNoun.replace(/^d[oa] /, "")}).`;

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
      showFirstCharge &&
      (dateChanged || planChanged || strategyChanged || timingChanged || priceChanged || isUninitialized) &&
      billingCalculation
    ) {
      form.setValue("dueDay", billingCalculation.terms.dueDay, { shouldDirty: true });
      form.setValue("firstChargeAmount", billingCalculation.first.amountCents, { shouldDirty: true });
      form.setValue("firstChargeDueDate", billingCalculation.first.dueDate, { shouldDirty: true });
    }
  }, [
    planStartDate,
    selectedPlanId,
    billingStrategy,
    cyclePaymentTiming,
    basePriceCents,
    billingCalculation,
    showFirstCharge,
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

    const isNewPlanAssignment = Boolean(
      values.planId && (!isEdit || values.planId !== client?.planId),
    );
    let initialChargePayload: CreateClient["initialCharge"] | undefined;

    if (isNewPlanAssignment && billingCalculation) {
      const { first } = billingCalculation;
      const chosenAmount =
        values.firstChargeAmount !== undefined && values.firstChargeAmount !== null
          ? Math.round(values.firstChargeAmount)
          : first.amountCents;

      if (chosenAmount > 0) {
        initialChargePayload = {
          amountCents: chosenAmount,
          dueDate: values.firstChargeDueDate || first.dueDate,
          periodStart: first.periodStart,
          periodEnd: first.periodEnd,
          isProrated: first.isProrated,
          proratedDays: first.proratedDays,
        };
      }
    }

    // Sem status: ativar/inativar so pelo menu da linha (com confirmacao).
    const payload: Omit<CreateClient, "status"> = {
      name: values.name,
      phone: values.phone,
      email: values.email || undefined,
      notes: values.notes || undefined,
      address: addressPayload,
      planId: values.planId || undefined,
      planStartDate: values.planId ? values.planStartDate || todayDateISO : undefined,
      billingStrategy: values.planId ? values.billingStrategy || "prorated" : undefined,
      cyclePaymentTiming: values.planId ? values.cyclePaymentTiming || "prepaid" : undefined,
      dueDay: values.planId ? values.dueDay || defaultDueDay : undefined,
      membershipStatus: values.planId ? values.membershipStatus || "active" : undefined,
      discount: values.planId ? discountPayload : undefined,
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
        await createMut.mutateAsync({ ...payload, status: "active" });
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
            placeholder="Informe o nome completo"
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                <div className={selectedPlanId ? "sm:col-span-3" : "sm:col-span-5"}>
                  <ComboboxField<ClientFormValues>
                    name="planId"
                    label="Plano de acesso"
                    placeholder="Nenhum plano (sem mensalidade fixa)"
                    searchPlaceholder="Filtrar plano por nome, período ou valor..."
                    emptyMessage="Nenhum plano encontrado."
                    options={planOptions}
                    clearable
                    disabled={pending}
                  />
                </div>

                {selectedPlanId ? (
                  <div className="sm:col-span-2">
                    <DateField<ClientFormValues>
                      name="planStartDate"
                      label="Início do plano"
                      hint="Data a partir de quando o plano entra em vigor."
                      disabled={pending}
                    />
                  </div>
                ) : null}
              </div>

              {showFirstCharge && billingCalculation ? (
                <div className="space-y-3 pt-2 border-t border-border/40 animate-in fade-in-50 duration-150">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <CalendarClock className="size-3.5 text-primary" />
                      Cobrança da 1ª mensalidade
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">
                      {usesOrgRule ? "Regra da academia" : "Regra deste aluno"}:{" "}
                      {TIMING_LABEL[billingCalculation.terms.timing]} •{" "}
                      {STRATEGY_LABEL[billingCalculation.terms.strategy]}
                    </span>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-muted/20 p-3.5 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <InputCurrency<ClientFormValues>
                        name="firstChargeAmount"
                        label="Valor da 1ª cobrança"
                        disabled={pending}
                        hint={firstChargeHint}
                      />
                      <DateField<ClientFormValues>
                        name="firstChargeDueDate"
                        label="Vencimento da 1ª cobrança"
                        disabled={pending}
                        hint={`Referente a ${shortDate(billingCalculation.first.periodStart)} a ${shortDate(billingCalculation.first.periodEnd)}.`}
                      />
                    </div>

                    {/* Rodapé: próxima cobrança e personalização opcional */}
                    <div className="pt-2 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <p className="text-[11px] text-muted-foreground">
                        {billingCalculation.next
                          ? `Próxima: ${shortDate(billingCalculation.next.dueDate)} · ${formatCents(billingCalculation.next.amountCents)}, referente a ${shortDate(billingCalculation.next.periodStart)} a ${shortDate(billingCalculation.next.periodEnd)}.`
                          : null}
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
                          Regra só para este aluno:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <SelectField<ClientFormValues>
                            name="cyclePaymentTiming"
                            label="Momento do pagamento"
                            clearable={false}
                            options={[
                              { value: "prepaid", label: "Antecipado (paga antes das aulas)" },
                              { value: "postpaid", label: "Depois do uso (paga ao fim do período)" },
                            ]}
                            disabled={pending}
                          />
                          <SelectField<ClientFormValues>
                            name="billingStrategy"
                            label="Entrada no meio do período"
                            clearable={false}
                            options={[
                              { value: "prorated", label: "Proporcional (só os dias restantes)" },
                              { value: "full_cycle", label: "Mês cheio (ciclo a partir da entrada)" },
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
                        ? "No mês cheio, é o dia de início do ciclo. Dia inexistente cai no último dia do mês."
                        : `Dia do mês das próximas mensalidades (padrão da academia: ${defaultDueDay}).`
                    }
                  />

                  {isEdit ? (
                    <SelectField<ClientFormValues>
                      name="membershipStatus"
                      label="Situação da assinatura"
                      options={MEMBERSHIP_STATUS_OPTIONS}
                      clearable={false}
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
                          clearable={false}
                          disabled={pending}
                        />
                        {discountType === "percentage" ? (
                          <InputNumber<ClientFormValues>
                            name="discountValue"
                            label="Desconto (%)"
                            placeholder="0"
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
                        placeholder="Informe o motivo do desconto (opcional)"
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

