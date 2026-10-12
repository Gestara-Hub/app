"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useFieldArray,
  useForm,
  FormProvider,
  useWatch,
  type Path,
  type FieldErrors,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarClock,
  AlertTriangle,
  FileText,
  MapPin,
  Percent,
  Plus,
  SlidersHorizontal,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
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
  SegmentedChoiceField,
  SelectField,
  TextArea,
  type SegmentedChoiceOption,
} from "@/components/form";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import { formatCents } from "@gestarahub/core/format";
import type { Address, Client, CreateClient, OrganizationSettings, PlanPeriod } from "@gestarahub/contracts";
import { useModel } from "@/features/auth";
import { useCharges, usePlans } from "@/features/turmas";
import { useOrganization } from "@/features/settings";
import { useCreateClient, useUpdateClient } from "../hooks/use-clients";
import { clientFormSchema, type ClientFormValues } from "../client-schema";
import { RecurringAuthorizationSection } from "./recurring-authorization-section";
import { addDays, format, parseISO } from "date-fns";
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

const PAYMENT_MODE_OPTIONS: SegmentedChoiceOption[] = [
  { value: "membership", label: "Paga mensalidade", description: "Plano e desconto opcional" },
  { value: "scholarship", label: "Bolsista", description: "Integral ou parcial" },
  { value: "none", label: "Não paga mensalidade", description: "Avulso ou experimental" },
];

const SCHOLARSHIP_BY_OPTIONS: SegmentedChoiceOption[] = [
  { value: "percent", label: "% de bolsa", description: "Desconto em % do plano" },
  { value: "amount", label: "Valor a pagar", description: "Quanto o aluno paga" },
];

const SCHOLARSHIP_KIND_OPTIONS: SegmentedChoiceOption[] = [
  { value: "full", label: "Integral", description: "Não paga mensalidade" },
  { value: "partial", label: "Parcial", description: "Paga uma parte" },
];

const GUARDIAN_RELATIONSHIPS = ["Mãe", "Pai", "Avó", "Avô", "Tio(a)"];

const SCHOLARSHIP_REASONS = ["Atleta", "Social", "Família de professor", "Parceria"];

const DISCOUNT_TYPE_OPTIONS = [
  { value: "fixed", label: "Valor fixo em reais (R$)" },
  { value: "percentage", label: "Porcentagem sobre a mensalidade (%)" },
];

const todayDateISO = format(new Date(), "yyyy-MM-dd");

function toDefaults(
  client?: Client,
  orgSettings?: OrganizationSettings,
  isClasses = true,
): ClientFormValues {
  const addr = client?.address;
  const isScholar = Boolean(client?.discount?.scholarship);
  const hasDiscount = Boolean(!isScholar && client?.discount && client.discount.value > 0);
  // Novo aluno comeca em "Paga mensalidade"; aluno salvo sem plano e sem bolsa
  // e "Não paga mensalidade". Fora do modelo de turmas nao ha essa escolha.
  const paymentMode = !isClasses
    ? undefined
    : isScholar
      ? "scholarship"
      : client && !client.planId
        ? "none"
        : "membership";
  const initialStartDate = client?.planStartDate || todayDateISO;
  const initialStrategy = client?.billingStrategy || orgSettings?.midMonthStrategy || "prorated";
  const initialTiming = client?.cyclePaymentTiming || orgSettings?.billingTiming || "prepaid";
  const defaultDueDay = client?.dueDay ?? orgSettings?.defaultDueDay ?? 10;

  return {
    name: client?.name ?? "",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    notes: client?.notes ?? "",
    birthDate: client?.birthDate ?? "",
    guardians: (client?.guardians ?? []).map((g) => ({
      name: g.name,
      relationship: g.relationship ?? "",
      phone: g.phone ?? "",
      email: g.email ?? "",
    })),
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
    paymentMode,
    scholarshipKind:
      isScholar && !(client?.discount?.type === "percentage" && client.discount.value >= 100)
        ? "partial"
        : "full",
    scholarshipBy: isScholar && client?.discount?.type === "fixed" ? "amount" : "percent",
    scholarshipPercent:
      isScholar && client?.discount?.type === "percentage" && client.discount.value < 100
        ? client.discount.value
        : 50,
    // Valor a pagar: preenchido quando o plano carrega (precisa do preco).
    scholarshipPayCents: undefined,
    discountValidUntil: client?.discount?.validUntil ?? "",
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
    return list;
  }, [plans]);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: toDefaults(client, orgSettings, isClasses),
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
  const paymentMode = useWatch({ control: form.control, name: "paymentMode" });
  const scholarshipKind = useWatch({ control: form.control, name: "scholarshipKind" });
  const scholarshipBy = useWatch({ control: form.control, name: "scholarshipBy" });
  const scholarshipPercentValue = useWatch({ control: form.control, name: "scholarshipPercent" });
  const scholarshipPayCents = useWatch({ control: form.control, name: "scholarshipPayCents" });
  const isScholarship = paymentMode === "scholarship";
  const isFullScholarship = isScholarship && scholarshipKind !== "partial";
  const addressValues = useWatch({
    control: form.control,
    name: "address",
  });
  const notesValue = useWatch({
    control: form.control,
    name: "notes",
  });
  const birthDate = useWatch({ control: form.control, name: "birthDate" });
  const {
    fields: guardianFields,
    append: appendGuardian,
    remove: removeGuardian,
  } = useFieldArray({ control: form.control, name: "guardians" });
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
  // Responsaveis: sempre comeca recolhido (o selo mostra quantos ha).
  const [guardiansOpen, setGuardiansOpen] = useState(false);

  const selectedPlan = useMemo(
    () => plans?.find((p) => p.id === selectedPlanId),
    [plans, selectedPlanId],
  );

  // Desconto efetivo do modo escolhido. Bolsa por "valor a pagar" vira desconto
  // fixo (preco do plano - valor pago); integral = 100%.
  const effectiveDiscount = useMemo(() => {
    if (isScholarship) {
      if (isFullScholarship) return { type: "percentage" as const, value: 100 };
      if (scholarshipBy === "amount") {
        const pay = Number(scholarshipPayCents) || 0;
        const price = selectedPlan?.priceCents ?? 0;
        return pay > 0 && price > pay ? { type: "fixed" as const, value: price - pay } : null;
      }
      const pct = Number(scholarshipPercentValue) || 0;
      return pct > 0 ? { type: "percentage" as const, value: Math.min(pct, 100) } : null;
    }
    if (paymentMode !== "membership" || !hasDiscount) return null;
    const value = Number(discountValue);
    return value > 0 ? { type: discountType ?? "fixed", value } : null;
  }, [
    isScholarship,
    isFullScholarship,
    scholarshipBy,
    scholarshipPayCents,
    scholarshipPercentValue,
    selectedPlan,
    paymentMode,
    hasDiscount,
    discountType,
    discountValue,
  ]);

  // Edicao de bolsa por valor: mostra quanto o aluno paga (preco - desconto).
  useEffect(() => {
    const d = client?.discount;
    if (!d?.scholarship || d.type !== "fixed" || !selectedPlan) return;
    if (form.getValues("scholarshipPayCents") !== undefined) return;
    if (selectedPlan.id !== client?.planId) return;
    form.setValue("scholarshipPayCents", Math.max(0, selectedPlan.priceCents - d.value));
  }, [client, selectedPlan, form]);

  const planFieldLabel = isFullScholarship
    ? "Plano de referência (opcional)"
    : isScholarship
      ? "Plano"
      : "Plano de acesso";
  // Inicio: com plano, ou na bolsa integral (sem plano, e o inicio das isentas).
  const showStartDate = paymentMode !== "none" && (Boolean(selectedPlanId) || isFullScholarship);

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
    if (paymentMode === "none") return "Sem mensalidade";
    if (isFullScholarship) return "Bolsista integral";
    if (!effectiveDiscount || !selectedPlanId) return null;
    if (isScholarship) {
      return scholarshipBy === "amount"
        ? `Paga ${formatCents(Number(scholarshipPayCents) || 0)}`
        : `Bolsa ${effectiveDiscount.value}%`;
    }
    if (effectiveDiscount.type === "percentage") {
      return `-${effectiveDiscount.value}%`;
    }
    return `-${formatCents(Math.round(effectiveDiscount.value))}`;
  }, [
    effectiveDiscount,
    isScholarship,
    isFullScholarship,
    selectedPlanId,
    paymentMode,
    scholarshipBy,
    scholarshipPayCents,
  ]);

  // Conta ao vivo da bolsa parcial: "Plano R$ 180,00 → paga R$ 90,00 (bolsa de 50%)".
  const partialSummary = useMemo(() => {
    if (!isScholarship || isFullScholarship || !selectedPlan || !effectiveDiscount) return null;
    const price = selectedPlan.priceCents;
    const pay =
      effectiveDiscount.type === "percentage"
        ? price - Math.round((price * effectiveDiscount.value) / 100)
        : price - effectiveDiscount.value;
    const pct = price > 0 ? Math.round(((price - pay) / price) * 100) : 0;
    return `Plano ${formatCents(price)} → paga ${formatCents(pay)} (bolsa de ${pct}%)`;
  }, [isScholarship, isFullScholarship, selectedPlan, effectiveDiscount]);

  const basePriceCents = useMemo(() => {
    if (!selectedPlan) return 0;
    let price = selectedPlan.priceCents;
    if (effectiveDiscount) {
      if (effectiveDiscount.type === "percentage") {
        const disc = Math.round((price * effectiveDiscount.value) / 100);
        price = Math.max(0, price - disc);
      } else {
        price = Math.max(0, price - Math.round(effectiveDiscount.value));
      }
    }
    return price;
  }, [selectedPlan, effectiveDiscount]);

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

  // Troca de plano com periodo ja pago: o plano novo comeca no periodo seguinte
  // (o servico tambem nunca cobra os mesmos dias duas vezes).
  const isPlanSwitch = Boolean(isEdit && client?.planId && selectedPlanId && selectedPlanId !== client.planId);
  const { data: studentCharges } = useCharges(
    isPlanSwitch && client ? { studentId: client.id, kind: "membership" } : undefined,
  );
  const lastPaidPeriod = useMemo(() => {
    if (!isPlanSwitch) return null;
    const paid = (studentCharges ?? []).filter(
      (c) => c.studentId === client?.id && c.status === "paid" && c.periodStart && c.periodEnd,
    );
    if (paid.length === 0) return null;
    return paid.reduce((a, b) => ((b.periodEnd ?? "") > (a.periodEnd ?? "") ? b : a));
  }, [isPlanSwitch, studentCharges, client?.id]);
  const paidUntil = lastPaidPeriod?.periodEnd;
  const nextAfterPaid = paidUntil ? format(addDays(parseISO(paidUntil), 1), "yyyy-MM-dd") : undefined;

  // Ao escolher o plano novo, sugere o inicio logo depois do ultimo periodo pago.
  const suggestedForPlanRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!isPlanSwitch || !nextAfterPaid || !selectedPlanId) return;
    if (suggestedForPlanRef.current === selectedPlanId) return;
    suggestedForPlanRef.current = selectedPlanId;
    if ((planStartDate || "") < nextAfterPaid) {
      form.setValue("planStartDate", nextAfterPaid, { shouldDirty: true });
    }
  }, [isPlanSwitch, nextAfterPaid, selectedPlanId, planStartDate, form]);

  const planSwitchNotice =
    isPlanSwitch && lastPaidPeriod && paidUntil && nextAfterPaid
      ? (planStartDate || "") <= paidUntil
        ? `O período de ${shortDate(lastPaidPeriod.periodStart ?? "")} a ${shortDate(paidUntil)} já foi pago${lastPaidPeriod.planName ? ` no plano ${lastPaidPeriod.planName}` : ""} e não será cobrado de novo. O plano novo começa a cobrar no período seguinte.`
        : `O período de ${shortDate(lastPaidPeriod.periodStart ?? "")} a ${shortDate(paidUntil)} já foi pago${lastPaidPeriod.planName ? ` no plano ${lastPaidPeriod.planName}` : ""}. O plano novo vale a partir de ${shortDate(nextAfterPaid)}. Se o plano estava errado, desfaça o pagamento em Mensalidades antes de trocar.`
      : null;
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
  const guardiansBadge =
    guardianFields.length > 0
      ? `${guardianFields.length} ${guardianFields.length === 1 ? "responsável" : "responsáveis"}`
      : undefined;

  // Idade pela data local; menor de idade sugere cadastrar um responsavel.
  const age = useMemo(() => {
    if (!birthDate) return null;
    const [y, m, d] = birthDate.split("-").map(Number);
    if (!y || !m || !d) return null;
    const today = new Date();
    let years = today.getFullYear() - y;
    if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) years -= 1;
    return years >= 0 ? years : null;
  }, [birthDate]);
  const birthDateHint =
    age === null
      ? "Usada para lembrar os aniversariantes."
      : age < 18 && guardianFields.length === 0
        ? `${age} ${age === 1 ? "ano" : "anos"}. Menor de idade: cadastre um responsável abaixo.`
        : `${age} ${age === 1 ? "ano" : "anos"}.`;

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
      errors.discountReason ||
      errors.scholarshipPercent ||
      errors.scholarshipPayCents
    ) {
      setPlanOpen(true);
    }
    if (errors.notes) {
      setNotesOpen(true);
    }
    if (errors.guardians) {
      setGuardiansOpen(true);
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

    const mode = values.paymentMode ?? "membership";
    const isScholar = mode === "scholarship";
    const isFull = isScholar && values.scholarshipKind !== "partial";
    // "Não paga mensalidade" nao leva plano; a bolsa integral pode ir sem plano.
    const planId = mode === "none" ? undefined : values.planId || undefined;
    const plan = plans?.find((p) => p.id === planId);

    if (isScholar && !isFull && values.scholarshipBy === "amount" && plan) {
      const pay = Math.round(values.scholarshipPayCents ?? 0);
      if (pay >= plan.priceCents) {
        form.setError("scholarshipPayCents", {
          message: `Use um valor menor que o do plano (${formatCents(plan.priceCents)}).`,
        });
        return;
      }
    }

    const reason = values.discountReason?.trim() || undefined;
    const validUntil = values.discountValidUntil || undefined;
    const discountPayload: CreateClient["discount"] = isScholar
      ? isFull
        ? { type: "percentage", value: 100, scholarship: true, reason, validUntil }
        : values.scholarshipBy === "amount"
          ? {
              type: "fixed",
              value: Math.max(0, (plan?.priceCents ?? 0) - Math.round(values.scholarshipPayCents ?? 0)),
              scholarship: true,
              reason,
              validUntil,
            }
          : {
              type: "percentage",
              value: Math.round(values.scholarshipPercent ?? 0),
              scholarship: true,
              reason,
              validUntil,
            }
      : mode === "membership" && values.hasDiscount && values.discountValue && values.discountValue > 0
        ? {
            type: values.discountType ?? "fixed",
            value: Math.round(values.discountValue),
            reason,
            validUntil,
          }
        : undefined;

    const isNewPlanAssignment = Boolean(
      planId && (!isEdit || planId !== client?.planId),
    );
    let initialChargePayload: CreateClient["initialCharge"] | undefined;

    if (isNewPlanAssignment && billingCalculation) {
      const { first } = billingCalculation;
      const chosenAmount =
        values.firstChargeAmount !== undefined && values.firstChargeAmount !== null
          ? Math.round(values.firstChargeAmount)
          : first.amountCents;

      // Bolsa integral: a 1a mensalidade sai como "Isento" (R$ 0).
      if (chosenAmount > 0 || discountPayload?.scholarship) {
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
      birthDate: values.birthDate || undefined,
      guardians: (values.guardians ?? []).length
        ? (values.guardians ?? []).map((g) => ({
            name: g.name.trim(),
            relationship: g.relationship?.trim() || undefined,
            phone: g.phone?.trim() || undefined,
            email: g.email?.trim() || undefined,
          }))
        : undefined,
      address: addressPayload,
      planId,
      // Bolsista integral sem plano tambem tem inicio, vencimento e situacao
      // (as mensalidades isentas seguem essa regra).
      planStartDate: planId || isFull ? values.planStartDate || todayDateISO : undefined,
      billingStrategy: planId || isFull ? values.billingStrategy || "prorated" : undefined,
      cyclePaymentTiming: planId || isFull ? values.cyclePaymentTiming || "prepaid" : undefined,
      dueDay: planId || isFull ? values.dueDay || defaultDueDay : undefined,
      membershipStatus: planId || isFull ? values.membershipStatus || "active" : undefined,
      discount: planId || isFull ? discountPayload : undefined,
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
            <DateField<ClientFormValues>
              name="birthDate"
              label="Data de nascimento"
              max={todayDateISO}
              hint={birthDateHint}
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
              <SegmentedChoiceField<ClientFormValues>
                name="paymentMode"
                ariaLabel="Como o aluno paga"
                options={PAYMENT_MODE_OPTIONS}
                disabled={pending}
              />

              {paymentMode === "none" ? (
                <p className="text-xs text-muted-foreground">
                  Sem plano e sem cobrança. Use para aula avulsa ou experimental.
                </p>
              ) : null}

              {isScholarship ? (
                <SegmentedChoiceField<ClientFormValues>
                  name="scholarshipKind"
                  ariaLabel="Tipo de bolsa"
                  options={SCHOLARSHIP_KIND_OPTIONS}
                  disabled={pending}
                />
              ) : null}

              {paymentMode !== "none" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                  <div className={showStartDate ? "sm:col-span-3" : "sm:col-span-5"}>
                    <ComboboxField<ClientFormValues>
                      name="planId"
                      label={planFieldLabel}
                      hint={isFullScholarship ? "Para saber quanto vale a bolsa." : undefined}
                      placeholder={isFullScholarship ? "Sem plano de referência" : "Selecione o plano"}
                      searchPlaceholder="Filtrar plano por nome, período ou valor..."
                      emptyMessage="Nenhum plano encontrado."
                      options={planOptions}
                      clearable
                      disabled={pending}
                    />
                  </div>

                  {showStartDate ? (
                    <div className="sm:col-span-2">
                      <DateField<ClientFormValues>
                        name="planStartDate"
                        label={isScholarship ? "Início da bolsa" : "Início do plano"}
                        hint={
                          isScholarship
                            ? "Data a partir de quando a bolsa vale."
                            : "Data a partir de quando o plano entra em vigor."
                        }
                        disabled={pending}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {planSwitchNotice ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-3 text-xs text-amber-800 dark:text-amber-300"
                >
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <p>{planSwitchNotice}</p>
                </div>
              ) : null}

              {showFirstCharge && billingCalculation && !isFullScholarship ? (
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

              {selectedPlanId || isFullScholarship ? (
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

              {paymentMode === "membership" && selectedPlanId ? (
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
                      <DateField<ClientFormValues>
                        name="discountValidUntil"
                        label="Válido até (opcional)"
                        hint="Depois dessa data, o desconto deixa de valer."
                        disabled={pending}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {isScholarship ? (
                <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3">
                  {scholarshipKind === "partial" ? (
                    selectedPlan ? (
                      <div className="space-y-3">
                        <SegmentedChoiceField<ClientFormValues>
                          name="scholarshipBy"
                          ariaLabel="Definir a bolsa por"
                          options={SCHOLARSHIP_BY_OPTIONS}
                          disabled={pending}
                        />
                        {scholarshipBy === "amount" ? (
                          <InputCurrency<ClientFormValues>
                            name="scholarshipPayCents"
                            label="Valor a pagar por período"
                            placeholder="0,00"
                            disabled={pending}
                          />
                        ) : (
                          <InputNumber<ClientFormValues>
                            name="scholarshipPercent"
                            label="Bolsa (%)"
                            placeholder="50"
                            min={1}
                            max={99}
                            disabled={pending}
                          />
                        )}
                        {partialSummary ? (
                          <p className="text-xs text-muted-foreground">{partialSummary}</p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Escolha o plano para definir quanto o aluno paga.
                      </p>
                    )
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      As mensalidades aparecem como Isento, sem cobrança.
                    </p>
                  )}

                  <div className="space-y-1.5">
                    <InputText<ClientFormValues>
                      name="discountReason"
                      label="Motivo da bolsa"
                      placeholder="Informe o motivo da bolsa (opcional)"
                      disabled={pending}
                    />
                    <div className="flex flex-wrap gap-1">
                      {SCHOLARSHIP_REASONS.map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            form.setValue("discountReason", reason, { shouldDirty: true })
                          }
                          className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          + {reason}
                        </button>
                      ))}
                    </div>
                  </div>

                  <DateField<ClientFormValues>
                    name="discountValidUntil"
                    label="Válida até (opcional)"
                    hint={
                      isFullScholarship && !selectedPlanId
                        ? "Depois dessa data, deixa de aparecer em Mensalidades."
                        : "Depois dessa data, volta ao valor cheio do plano."
                    }
                    disabled={pending}
                  />
                </div>
              ) : null}

              {/* Pix Automatico: so para o plano ja salvo do aluno */}
              {isEdit && client?.planId && selectedPlanId === client.planId ? (
                <RecurringAuthorizationSection
                  studentId={client.id}
                  studentName={client.name}
                  planPriceCents={plans?.find((p) => p.id === client.planId)?.priceCents}
                />
              ) : null}
            </div>
          </CollapsibleSection>
        ) : null}

        {/* Responsáveis (opcional, so turmas): recolhido por padrão */}
        {isClasses ? (
          <CollapsibleSection
            title="Responsáveis (opcional)"
            icon={<Users className="h-4 w-4" />}
            badge={guardiansBadge}
            open={guardiansOpen}
            onOpenChange={setGuardiansOpen}
          >
            <div className="space-y-3">
              {guardianFields.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Pais, avós ou outra pessoa para contato. Recomendado para menores de idade.
                </p>
        ) : null}

            {guardianFields.map((field, index) => (
              <div
                key={field.id}
                className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    Responsável {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeGuardian(index)}
                    disabled={pending}
                    aria-label={`Remover responsável ${index + 1}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InputText<ClientFormValues>
                    name={`guardians.${index}.name`}
                    label="Nome"
                    placeholder="Informe o nome do responsável"
                    required
                    disabled={pending}
                  />
                  <InputText<ClientFormValues>
                    name={`guardians.${index}.relationship`}
                    label="Parentesco"
                    placeholder="Informe o parentesco (opcional)"
                    disabled={pending}
                  />
                  <InputPhone<ClientFormValues>
                    name={`guardians.${index}.phone`}
                    label="Telefone (WhatsApp)"
                    disabled={pending}
                  />
                  <InputText<ClientFormValues>
                    name={`guardians.${index}.email`}
                    type="email"
                    label="E-mail"
                    placeholder="Informe o e-mail (opcional)"
                    disabled={pending}
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {GUARDIAN_RELATIONSHIPS.map((relationship) => (
                    <button
                      key={relationship}
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        form.setValue(`guardians.${index}.relationship`, relationship, {
                          shouldDirty: true,
                        })
                      }
                      className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      + {relationship}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => appendGuardian({ name: "", relationship: "", phone: "", email: "" })}
              disabled={pending}
            >
              <Plus className="size-4" />
              Adicionar responsável
            </Button>
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
                ? "Salvar"
                : "Adicionar"}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}

