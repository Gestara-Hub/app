"use client";

import { packageExpiresAt } from "@gestarahub/core/packages";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  CheckCircle2,
  FileText,
  MapPin,
  MessageCircle,
  Percent,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Ticket,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "@/lib/toast";
import {
  AddressFields,
  CollapsibleSection,
  ComboboxField,
  DateField,
  InputCpf,
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
import { Checkbox } from "@/components/ui/checkbox";
import { DialogBody, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import { formatCents, plural } from "@gestarahub/core/format";
import type {
  Address,
  ClassBillingMode,
  Client,
  CreateClient,
  LessonPackage,
  MinorConsentStatus,
  OrganizationSettings,
  PlanPeriod,
} from "@gestarahub/contracts";
import { useCan, useModel } from "@/features/auth";
import { useWhatsAppSend } from "@/features/communication";
import {
  SellPackageDialog,
  StudentPackageBadge,
  displayPackage,
  pastEndHint,
  paymentSummary,
  useCharges,
  useLessonPackages,
  usePlans,
  useSellPackage,
  useStudentPackages,
} from "@/features/turmas";
import { useBusinessSegment, useOrganization } from "@/features/settings";
import { useClients, useCreateClient, useUpdateClient } from "../hooks/use-clients";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { pauseDescription, pausedChargeDescription, planSwitchDescription, replacedMembershipCharges } from "../plan-switch";
import { normalizeText } from "@/lib/text";
import { whatsappDigits } from "@gestarahub/core/phone";
import { cpfDigits } from "@gestarahub/core/payer";
import { NOTES_MAX, clientFormSchema, defaultPaymentMode, isPackageSale, type ClientFormValues } from "../client-schema";
import { RecurringAuthorizationSection } from "./recurring-authorization-section";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { whatsappNumber } from "@/lib/whatsapp";
import {
  MAX_INSTALLMENTS,
  chargesDueBefore,
  isCurrentOpenMembershipCharge,
  resolveMembershipTerms,
  upcomingCharges,
} from "@gestarahub/core/billing";
import { ageLabel } from "@/lib/birthdays";
import { dateInSpace } from "@gestarahub/core/date";

/** Teto da 1a cobranca (R$ 100.000,00): evita valor digitado errado. */
const MAX_FIRST_CHARGE_CENTS = 10_000_000;

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
  { value: "package", label: "Pacote de aulas", description: "Compra um número de aulas" },
  { value: "scholarship", label: "Bolsista", description: "Integral ou parcial" },
  { value: "none", label: "Não paga mensalidade", description: "Curso, avulso ou experimental" },
];

const PACKAGE_INSTALLMENT_OPTIONS = Array.from({ length: MAX_INSTALLMENTS }, (_, i) => ({
  value: String(i + 1),
  label: i === 0 ? "À vista" : `${i + 1}x`,
}));

/** "10 aulas · vale 30 dias" (ou "sem validade"), como em "Vender pacote". */
function packageFacts(pkg: LessonPackage): string {
  const validity = !pkg.validityDays
    ? "sem validade"
    : pkg.validityDays === 365
      ? "vale 1 ano"
      : `vale ${pkg.validityDays} dias`;
  return `${plural(pkg.lessons, "aula", "aulas")} · ${validity}`;
}

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
  { value: "fixed", label: "Valor em R$" },
  { value: "percentage", label: "Porcentagem (%)" },
];

// Lido na hora (nao no carregamento do modulo): o fuso do espaco ja esta ligado.
const todayDateISO = () => dateInSpace();

function toDefaults(
  client?: Client,
  orgSettings?: OrganizationSettings,
  isClasses = true,
  areaBillingMode: ClassBillingMode = "membership",
  canSellPackage = false,
): ClientFormValues {
  const addr = client?.address;
  const isScholar = Boolean(client?.discount?.scholarship);
  const hasDiscount = Boolean(!isScholar && client?.discount && client.discount.value > 0);
  const paymentMode = defaultPaymentMode({ client, isClasses, areaBillingMode });
  const initialStartDate = client?.planStartDate || todayDateISO();
  const initialStrategy = client?.billingStrategy || orgSettings?.midMonthStrategy || "prorated";
  const initialTiming = client?.cyclePaymentTiming || orgSettings?.billingTiming || "prepaid";
  const defaultDueDay = client?.dueDay ?? orgSettings?.defaultDueDay ?? 10;

  return {
    name: client?.name ?? "",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    notes: client?.notes ?? "",
    birthDate: client?.birthDate ?? "",
    cpf: client?.cpf ?? "",
    guardians: (client?.guardians ?? []).map((g) => ({
      name: g.name,
      relationship: g.relationship ?? "",
      phone: g.phone ?? "",
      email: g.email ?? "",
      cpf: g.cpf ?? "",
      financial: g.financial ?? false,
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
    billPastMonths: "no",
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
    // Aluno novo com "Pacote de aulas": o cadastro ja vende o pacote.
    sellsPackage: !client && canSellPackage,
    packageId: "",
    packagePriceCents: 0,
    packageInstallments: "1",
    packageFirstDueDate: todayDateISO(),
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
    minorConsentStatus: client?.minorConsentStatus ?? "not_applicable",
    minorConsentAt: client?.minorConsentAt ?? "",
    minorConsentBy: client?.minorConsentBy ?? "",
    hasPaperConsent: client?.minorConsentStatus === "confirmed_paper",
  };
}

interface ClientFormProps {
  client?: Client;
  onSuccess: (savedClient?: Client) => void;
  onCancel?: () => void;
  formId: string;
  isPage?: boolean;
  /** Avisa o diálogo se há alterações não salvas (para confirmar o descarte). */
  onDirtyChange?: (dirty: boolean) => void;
}

export function ClientForm({
  client,
  onSuccess,
  onCancel,
  formId,
  isPage = false,
  onDirtyChange,
}: ClientFormProps) {
  const isEdit = Boolean(client);
  const isClasses = useModel() === "classes";
  // Fora da area de mensalidade (curso, pacote, sem cobranca): aluno novo
  // comeca em "Não paga mensalidade".
  const areaBillingMode = useBusinessSegment().defaultBillingMode;
  const createMut = useCreateClient();
  // Cadastro novo com o telefone de alguem ja cadastrado pergunta antes (duplicado).
  const { data: existingClients } = useClients(undefined, !isEdit);
  const { confirm: confirmDuplicate, dialog: duplicateDialog } = useConfirmAction();
  const { confirm: confirmPlanSwitch, dialog: planSwitchDialog } = useConfirmAction();
  const { confirm: confirmPause, dialog: pauseDialog } = useConfirmAction();
  const { confirm: confirmPausedCharge, dialog: pausedChargeDialog } = useConfirmAction();
  // Boas-vindas pelo WhatsApp do proprio espaco, oferecidas no aviso de cadastro.
  const whatsapp = useWhatsAppSend();
  const updateMut = useUpdateClient();
  const sellPackageMut = useSellPackage();
  const pending = createMut.isPending || updateMut.isPending || sellPackageMut.isPending;
  // Vender pacote pede a mesma permissao da cobranca avulsa.
  const can = useCan();
  const canSellPackage = isClasses && can("billing:manage");

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
        label: `${cleanName} · ${formatCents(p.priceCents)}/${PERIOD_SUFFIX[p.period ?? "monthly"]}`,
      };
    });
    return list;
  }, [plans]);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: toDefaults(client, orgSettings, isClasses, areaBillingMode, canSellPackage),
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
  const billPastMonths = useWatch({
    control: form.control,
    name: "billPastMonths",
  });
  const discountValidUntil = useWatch({
    control: form.control,
    name: "discountValidUntil",
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
  // So mensalidade e bolsa usam plano; pacote e "Não paga" ficam sem ele.
  const usesPlan = paymentMode === "membership" || isScholarship;
  const isPackageMode = paymentMode === "package";
  const sellsPackage = useWatch({ control: form.control, name: "sellsPackage" });
  const [packageId, packagePriceCents, packageInstallments, packageFirstDueDate] = useWatch({
    control: form.control,
    name: ["packageId", "packagePriceCents", "packageInstallments", "packageFirstDueDate"],
  });
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
  const guardianValues = useWatch({ control: form.control, name: "guardians" });
  // Um so responsavel financeiro: marcar um desmarca os outros.
  const setFinancialGuardian = (index: number, checked: boolean) => {
    (form.getValues("guardians") ?? []).forEach((_, i) => {
      const next = i === index ? checked : false;
      if (Boolean(form.getValues(`guardians.${i}.financial`)) !== next) {
        form.setValue(`guardians.${i}.financial`, next, { shouldDirty: true });
      }
    });
  };
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
      // A area vem da mesma organizacao: corrige o padrao se ainda nao mexeram.
      const mode = defaultPaymentMode({ isClasses, areaBillingMode });
      if (mode && !form.getFieldState("paymentMode").isDirty && form.getValues("paymentMode") !== mode) {
        form.resetField("paymentMode", { defaultValue: mode });
      }
    }
  }, [orgSettings, client, form, isClasses, areaBillingMode]);

  // Pacote de aulas: catalogo para a venda no cadastro e o pacote atual na edicao.
  const { data: packageCatalog, isPending: packageCatalogPending } = useLessonPackages({ status: "active" });
  const packageOptions = useMemo(
    () => (packageCatalog ?? []).map((p) => ({ value: p.id, label: p.name })),
    [packageCatalog],
  );
  const chosenPackage = (packageCatalog ?? []).find((p) => p.id === packageId);
  // Escolher o pacote preenche o valor dele (editavel: e o unico desconto).
  const pricedForRef = useRef("");
  useEffect(() => {
    if (!chosenPackage || pricedForRef.current === chosenPackage.id) return;
    pricedForRef.current = chosenPackage.id;
    form.setValue("packagePriceCents", chosenPackage.priceCents, { shouldDirty: true });
  }, [chosenPackage, form]);
  const packageSaleSummary = paymentSummary(
    packagePriceCents ?? 0,
    Number(packageInstallments || 1),
    packageFirstDueDate ?? "",
  );

  const packagePastEnd = pastEndHint(
    Number(packageInstallments || 1),
    packageFirstDueDate ?? "",
    packageExpiresAt(todayDateISO(), chosenPackage?.validityDays),
    "a validade do pacote",
  );

  const { data: ownedPackages } = useStudentPackages(
    client ? { studentId: client.id } : undefined,
    Boolean(client) && isClasses,
  );
  const currentPackage = useMemo(() => displayPackage(ownedPackages ?? []), [ownedPackages]);
  const [sellPackageOpen, setSellPackageOpen] = useState(false);
  // Aluno salvo sem plano e com pacote em uso abre em "Pacote de aulas".
  const packageModeCheckedRef = useRef(false);
  useEffect(() => {
    if (!client || !ownedPackages || packageModeCheckedRef.current) return;
    packageModeCheckedRef.current = true;
    const mode = defaultPaymentMode({ client, isClasses, areaBillingMode, hasActivePackage: Boolean(currentPackage) });
    if (mode && !form.getFieldState("paymentMode").isDirty && form.getValues("paymentMode") !== mode) {
      form.resetField("paymentMode", { defaultValue: mode });
    }
  }, [client, ownedPackages, currentPackage, form, isClasses, areaBillingMode]);

  const [planOpen, setPlanOpen] = useState(() => !client);
  const [addressOpen, setAddressOpen] = useState(
    Boolean(
      client?.address?.street ||
        client?.address?.postalCode ||
        client?.address?.city,
    ),
  );
  const [notesOpen, setNotesOpen] = useState(Boolean(client?.notes?.trim()));
  const [guardiansUserToggled, setGuardiansUserToggled] = useState<boolean | null>(null);
  const [sendWelcome, setSendWelcome] = useState(false);

  const selectedPlan = useMemo(
    () => plans?.find((p) => p.id === selectedPlanId),
    [plans, selectedPlanId],
  );
  // Como o motor usa o dia do vencimento em cada periodicidade (COB-22).
  const planPeriod = selectedPlan?.period ?? "monthly";
  const cycleDays =
    planPeriod === "weekly" ? 7 : planPeriod === "biweekly" && billingStrategy === "full_cycle" ? 15 : null;
  const isBiweekly = planPeriod === "biweekly" && !cycleDays;
  const watchedDueDay = useWatch({ control: form.control, name: "dueDay" });
  const biweeklyDueDay = Math.min(Math.max(Number(watchedDueDay) || 1, 1), 15);

  // Desconto acima do plano ou de 100%: avisa na hora (sem esperar salvar) e
  // nao zera a previa da 1a cobranca como se o desconto valesse.
  const discountOverflowError = useMemo(() => {
    if (paymentMode !== "membership" || !hasDiscount) return null;
    const val = Number(discountValue) || 0;
    if (val <= 0) return null;
    if (discountType === "percentage") {
      return val > 100 ? "O desconto percentual não pode ser superior a 100%." : null;
    }
    if (selectedPlan && Math.round(val) > selectedPlan.priceCents) {
      return `O desconto passa do valor do plano (${formatCents(selectedPlan.priceCents)}).`;
    }
    return null;
  }, [paymentMode, hasDiscount, discountValue, discountType, selectedPlan]);

  useEffect(() => {
    if (discountOverflowError) {
      form.setError("discountValue", { type: "manual", message: discountOverflowError });
    } else if (form.getFieldState("discountValue").error?.type === "manual") {
      form.clearErrors("discountValue");
    }
  }, [discountOverflowError, form]);

  const scholarshipOverflowError = useMemo(() => {
    if (!isScholarship || isFullScholarship) return null;
    if (scholarshipBy === "amount") {
      const pay = Math.round(Number(scholarshipPayCents) || 0);
      if (selectedPlan && pay >= selectedPlan.priceCents) {
        return `Use um valor menor que o do plano (${formatCents(selectedPlan.priceCents)}).`;
      }
      return null;
    }
    const pct = Number(scholarshipPercentValue) || 0;
    return pct >= 100 ? "Use de 1% a 99%. Para 100%, escolha bolsa integral." : null;
  }, [
    isScholarship,
    isFullScholarship,
    scholarshipBy,
    scholarshipPayCents,
    selectedPlan,
    scholarshipPercentValue,
  ]);

  useEffect(() => {
    const fieldName = scholarshipBy === "amount" ? "scholarshipPayCents" : "scholarshipPercent";
    const otherField = scholarshipBy === "amount" ? "scholarshipPercent" : "scholarshipPayCents";
    if (form.getFieldState(otherField).error?.type === "manual") {
      form.clearErrors(otherField);
    }
    if (scholarshipOverflowError) {
      form.setError(fieldName, { type: "manual", message: scholarshipOverflowError });
    } else if (form.getFieldState(fieldName).error?.type === "manual") {
      form.clearErrors(fieldName);
    }
  }, [scholarshipOverflowError, scholarshipBy, form]);

  // Desconto efetivo do modo escolhido. Bolsa por "valor a pagar" vira desconto
  // fixo (preco do plano - valor pago); integral = 100%.
  const effectiveDiscount = useMemo(() => {
    if (isScholarship) {
      if (isFullScholarship) return { type: "percentage" as const, value: 100 };
      if (scholarshipOverflowError) return null;
      if (scholarshipBy === "amount") {
        const pay = Number(scholarshipPayCents) || 0;
        const price = selectedPlan?.priceCents ?? 0;
        return pay > 0 && price > pay ? { type: "fixed" as const, value: price - pay } : null;
      }
      const pct = Number(scholarshipPercentValue) || 0;
      return pct > 0 ? { type: "percentage" as const, value: Math.min(pct, 100) } : null;
    }
    if (paymentMode !== "membership" || !hasDiscount || discountOverflowError) return null;
    const value = Number(discountValue);
    return value > 0 ? { type: discountType ?? "fixed", value } : null;
  }, [
    isScholarship,
    isFullScholarship,
    scholarshipOverflowError,
    scholarshipBy,
    scholarshipPayCents,
    scholarshipPercentValue,
    selectedPlan,
    paymentMode,
    hasDiscount,
    discountOverflowError,
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
  const showStartDate = usesPlan && (Boolean(selectedPlanId) || isFullScholarship);

  const planBadge = !usesPlan
    ? undefined
    : selectedPlan
    ? `${selectedPlan.name.replace(/^(Mensal|Quinzenal|Semanal)\s*[-–—:]\s*/i, "").trim()} · ${formatCents(selectedPlan.priceCents)}/${PERIOD_SUFFIX[selectedPlan.period ?? "monthly"]}`
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
    if (isPackageMode) return chosenPackage?.name ?? currentPackage?.name ?? "Pacote de aulas";
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
    isPackageMode,
    chosenPackage,
    currentPackage,
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

  // Conta ao vivo do desconto: "Plano R$ 150,00 → paga R$ 120,00". Valor todo
  // vira isento; acima do plano, o erro do campo explica ao salvar.
  const discountSummary = useMemo(() => {
    if (isScholarship || paymentMode !== "membership" || !hasDiscount) return null;
    if (!selectedPlan || !effectiveDiscount) return null;
    const price = selectedPlan.priceCents;
    const off =
      effectiveDiscount.type === "percentage"
        ? Math.round((price * effectiveDiscount.value) / 100)
        : Math.round(effectiveDiscount.value);
    if (off > price) return null;
    return off === price
      ? `Plano ${formatCents(price)} → isento (desconto do valor todo)`
      : `Plano ${formatCents(price)} → paga ${formatCents(price - off)}`;
  }, [isScholarship, paymentMode, hasDiscount, selectedPlan, effectiveDiscount]);

  // Editando: desconto ou bolsa trocados valem do proximo periodo (o motor
  // refaz so as mensalidades que ainda nao comecaram). COB-32.
  const discountWhen =
    isEdit &&
    client?.planId &&
    client.planId === selectedPlanId &&
    JSON.stringify(effectiveDiscount ? { type: effectiveDiscount.type, value: effectiveDiscount.value } : null) !==
      JSON.stringify(client.discount ? { type: client.discount.type, value: client.discount.value } : null)
      ? " Vale a partir do próximo período; o atual não muda."
      : "";

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

  // Aluno antigo cadastrado agora (decisao de 31/10/2026): o que venceria antes
  // deste mes so e cobrado se o dono escolher "Desde o início".
  const currentMonthStart = `${todayDateISO().slice(0, 7)}-01`;

  const clientChargesFrom = client?.chargesFrom;
  // Mesmo motor da geracao em lote e da previa das Configuracoes.
  const billingCalculation = useMemo(() => {
    if (!selectedPlan) return null;
    // Revisao geral de 31/10/2026: o motor recebe o preco cheio e o desconto com a
    // validade (achado V6: a previa e o valor gravado ignoravam o fim do desconto)
    // e, na troca de plano, o "a partir de" do aluno antigo (achado V1).
    const input = {
      period: selectedPlan.period,
      planPriceCents: selectedPlan.priceCents,
      ...(effectiveDiscount ? { discount: { ...effectiveDiscount, validUntil: discountValidUntil || undefined } } : {}),
      startDate: planStartDate || todayDateISO(),
      strategy: billingStrategy,
      timing: cyclePaymentTiming,
      dueDay: billingStrategy === "full_cycle" ? undefined : defaultDueDay,
      ...(isEdit && clientChargesFrom ? { chargesFrom: clientChargesFrom } : {}),
    };
    const fullTerms = resolveMembershipTerms(input, orgSettings);
    const pastCharges = isEdit || isFullScholarship ? [] : chargesDueBefore(fullTerms, currentMonthStart);
    const terms =
      pastCharges.length > 0 && billPastMonths !== "yes"
        ? resolveMembershipTerms({ ...input, chargesFrom: currentMonthStart }, orgSettings)
        : fullTerms;
    const [first, next] = upcomingCharges(terms, 2);
    return { terms, first, next, pastCharges };
  }, [
    selectedPlan,
    effectiveDiscount,
    discountValidUntil,
    clientChargesFrom,
    planStartDate,
    billingStrategy,
    cyclePaymentTiming,
    defaultDueDay,
    orgSettings,
    isEdit,
    isFullScholarship,
    billPastMonths,
    currentMonthStart,
  ]);

  // A 1a cobranca aparece no cadastro e quando o aluno troca de plano.
  const showFirstCharge = Boolean(usesPlan && selectedPlanId && (!isEdit || selectedPlanId !== client?.planId));
  const pastCharges = showFirstCharge ? (billingCalculation?.pastCharges ?? []) : [];
  const asksPastMonths = pastCharges.length > 0;
  const pastMonthsOptions: SegmentedChoiceOption[] = asksPastMonths
    ? [
        {
          value: "no",
          label: "A partir deste mês",
          description: `Cobra a partir de ${format(parseISO(currentMonthStart), "MMMM", { locale: ptBR })}`,
        },
        {
          value: "yes",
          label: "Desde o início",
          description: `${plural(pastCharges.length, "mensalidade vencida", "mensalidades vencidas")}, desde ${format(parseISO(pastCharges[0].dueDate), "MMM/yyyy", { locale: ptBR })}`,
        },
      ]
    : [];

  // Troca de plano com periodo ja pago: o plano novo comeca no periodo seguinte
  // (o servico tambem nunca cobra os mesmos dias duas vezes).
  const isPlanSwitch = Boolean(
    usesPlan && isEdit && client?.planId && selectedPlanId && selectedPlanId !== client.planId,
  );
  // Pausar a assinatura: a mensalidade do mes em curso entra na confirmacao.
  const selectedMembershipStatus = useWatch({ control: form.control, name: "membershipStatus" });
  const isPausing = Boolean(
    usesPlan && isEdit && client?.membershipStatus !== "paused" && selectedMembershipStatus === "paused",
  );
  const { data: studentCharges } = useCharges(
    (isPlanSwitch || isPausing) && client ? { studentId: client.id, kind: "membership" } : undefined,
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
        : `O período de ${shortDate(lastPaidPeriod.periodStart ?? "")} a ${shortDate(paidUntil)} já foi pago${lastPaidPeriod.planName ? ` no plano ${lastPaidPeriod.planName}` : ""}. O plano novo vale a partir de ${shortDate(nextAfterPaid)}. Se o plano estava errado, desfaça o pagamento em Cobranças antes de trocar.`
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
  const prevPastRef = useRef(billPastMonths);

  useEffect(() => {
    const dateChanged = prevDateRef.current !== planStartDate;
    const planChanged = prevPlanRef.current !== selectedPlanId;
    const strategyChanged = prevStrategyRef.current !== billingStrategy;
    const timingChanged = prevTimingRef.current !== cyclePaymentTiming;
    const priceChanged = prevPriceRef.current !== basePriceCents;
    const pastChanged = prevPastRef.current !== billPastMonths;
    const isUninitialized = Boolean(selectedPlanId && billingCalculation && firstChargeAmount === undefined);

    prevDateRef.current = planStartDate;
    prevPlanRef.current = selectedPlanId;
    prevStrategyRef.current = billingStrategy;
    prevTimingRef.current = cyclePaymentTiming;
    prevPriceRef.current = basePriceCents;
    prevPastRef.current = billPastMonths;

    if (
      showFirstCharge &&
      (dateChanged || planChanged || strategyChanged || timingChanged || priceChanged || pastChanged || isUninitialized) &&
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
    billPastMonths,
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

  const isMinor = age !== null && age < 18;
  const guardiansOpen =
    guardiansUserToggled !== null
      ? guardiansUserToggled
      : isMinor || (client?.guardians?.length ?? 0) > 0;

  const birthDateHint =
    age === null
      ? "Usada para lembrar os aniversariantes."
      : age < 18 && guardianFields.length === 0
        ? `${ageLabel(age)}. Menor de idade: cadastre um responsável abaixo.`
        : `${ageLabel(age)}.`;

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
      errors.scholarshipPayCents ||
      errors.packageId ||
      errors.packagePriceCents ||
      errors.packageInstallments ||
      errors.packageFirstDueDate
    ) {
      setPlanOpen(true);
    }
    if (errors.notes) {
      setNotesOpen(true);
    }
    if (errors.guardians) {
      setGuardiansUserToggled(true);
    }
  }, []);

  const onSubmit = async (values: ClientFormValues) => {
    if (!isEdit) {
      const phone = whatsappDigits(values.phone) ?? values.phone.replace(/\D/g, "");
      const same = (existingClients ?? []).find(
        (c) => phone && (whatsappDigits(c.phone) ?? c.phone.replace(/\D/g, "")) === phone,
      );
      if (same) {
        const sameName = normalizeText(same.name) === normalizeText(values.name);
        const ok = await confirmDuplicate({
          title: sameName ? "Cadastro repetido?" : "Telefone já cadastrado",
          description: sameName
            ? `${same.name} já está cadastrado com este telefone.`
            : `O telefone já é de ${same.name}. Cadastrar mesmo assim?`,
          confirmLabel: "Cadastrar mesmo assim",
          cancelLabel: "Voltar",
          variant: "default",
          highlightAction: "cancel",
        });
        if (!ok) return;
      }
    }
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
    // "Não paga mensalidade" e "Pacote de aulas" nao levam plano; a bolsa
    // integral pode ir sem plano.
    const planId = mode === "none" || mode === "package" ? undefined : values.planId || undefined;
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

    if (mode === "membership" && values.hasDiscount && values.discountType !== "percentage" && plan) {
      if (Math.round(values.discountValue ?? 0) > plan.priceCents) {
        form.setError("discountValue", {
          message: `O desconto passa do valor do plano (${formatCents(plan.priceCents)}).`,
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

    // 1a cobranca: vazia ou zero nao viram a previa em silencio; valor absurdo, nao.
    if (isNewPlanAssignment && billingCalculation && showFirstCharge && !discountPayload?.scholarship) {
      const amount = values.firstChargeAmount;
      const message =
        amount === undefined || amount === null
          ? "Informe o valor da 1ª cobrança."
          : amount <= 0 && billingCalculation.first.amountCents > 0
            ? "Use um valor maior que zero. Para não cobrar, use desconto ou bolsa."
            : amount > MAX_FIRST_CHARGE_CENTS
              ? "Valor muito alto. Confira o valor da 1ª cobrança."
              : null;
      if (message) {
        form.setError("firstChargeAmount", { message });
        return;
      }
    }

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

    const isMinor = age !== null && age < 18;
    let minorConsentStatus: MinorConsentStatus = client?.minorConsentStatus || "not_applicable";
    let minorConsentAt = client?.minorConsentAt;
    let minorConsentBy = client?.minorConsentBy;
    let minorConsentEvidence = client?.minorConsentEvidence;

    if (isMinor) {
      if (values.hasPaperConsent) {
        minorConsentStatus = "confirmed_paper";
        minorConsentAt = minorConsentAt || new Date().toISOString();
        minorConsentBy =
          values.guardians?.[0]?.name || client?.minorConsentBy || "Responsável legal (termo impresso)";
        minorConsentEvidence = { method: "paper_form_declaration", recordedAt: new Date().toISOString() };
      } else if (!client || !client.minorConsentStatus || client.minorConsentStatus === "not_applicable") {
        minorConsentStatus = "pending";
      }
    } else {
      minorConsentStatus = "not_applicable";
    }

    // Sem status: ativar/inativar so pelo menu da linha (com confirmacao).
    const payload: Omit<CreateClient, "status"> = {
      name: values.name,
      phone: values.phone,
      email: values.email || undefined,
      notes: values.notes || undefined,
      birthDate: values.birthDate || undefined,
      cpf: cpfDigits(values.cpf) || undefined,
      guardians: (values.guardians ?? []).length
        ? (values.guardians ?? []).map((g) => ({
            name: g.name.trim(),
            relationship: g.relationship?.trim() || undefined,
            phone: g.phone?.trim() || undefined,
            email: g.email?.trim() || undefined,
            cpf: cpfDigits(g.cpf) || undefined,
            financial: g.financial || undefined,
          }))
        : undefined,
      minorConsentStatus,
      minorConsentAt,
      minorConsentBy,
      minorConsentEvidence,
      address: addressPayload,
      planId,
      // Bolsista integral sem plano tambem tem inicio, vencimento e situacao
      // (as mensalidades isentas seguem essa regra).
      planStartDate: planId || isFull ? values.planStartDate || todayDateISO() : undefined,
      chargesFrom: planId && asksPastMonths && values.billPastMonths !== "yes" ? currentMonthStart : undefined,
      billingStrategy: planId || isFull ? values.billingStrategy || "prorated" : undefined,
      cyclePaymentTiming: planId || isFull ? values.cyclePaymentTiming || "prepaid" : undefined,
      dueDay: planId || isFull ? values.dueDay || defaultDueDay : undefined,
      membershipStatus: planId || isFull ? values.membershipStatus || "active" : undefined,
      discount: planId || isFull ? discountPayload : undefined,
      initialCharge: initialChargePayload,
    };

    // Trocar o plano refaz as mensalidades em aberto: dinheiro, so com confirmacao.
    if (isEdit && client?.planId && planId && planId !== client.planId) {
      const ok = await confirmPlanSwitch({
        title: "Trocar o plano do aluno?",
        description: planSwitchDescription({
          fromPlan: plans?.find((p) => p.id === client.planId)?.name ?? "o plano atual",
          toPlan: plan?.name ?? "o plano novo",
          startDate: payload.planStartDate ?? todayDateISO(),
          replaced: replacedMembershipCharges(studentCharges ?? [], payload.planStartDate ?? todayDateISO()),
          firstCharge: initialChargePayload,
        }),
        confirmLabel: "Trocar o plano",
        cancelLabel: "Voltar",
        variant: "default",
      });
      if (!ok) return;
    }

    // Pausar: dinheiro e lembretes mudam, entao confirma; a mensalidade do mes em
    // curso fica a escolha do dono (cancelar ou manter em aberto).
    let cancelCurrentMembershipCharge = false;
    if (isEdit && client && client.membershipStatus !== "paused" && payload.membershipStatus === "paused") {
      const currentCharges = (studentCharges ?? []).filter((c) => isCurrentOpenMembershipCharge(c, todayDateISO()));
      const okPause = await confirmPause({
        title: "Pausar a assinatura?",
        description: pauseDescription(),
        confirmLabel: "Pausar",
        cancelLabel: "Voltar",
        variant: "default",
      });
      if (!okPause) return;
      if (currentCharges.length > 0) {
        cancelCurrentMembershipCharge = await confirmPausedCharge({
          title: "E a mensalidade em aberto?",
          description: pausedChargeDescription(currentCharges),
          confirmLabel: "Cancelar a cobrança",
          cancelLabel: "Manter em aberto",
        });
      }
    }

    try {
      if (isEdit && client) {
        await updateMut.mutateAsync({
          id: client.id,
          payload: cancelCurrentMembershipCharge ? { ...payload, cancelCurrentMembershipCharge } : payload,
        });
        toast.success(
          isClasses
            ? "Aluno atualizado com sucesso."
            : "Cliente atualizado com sucesso.",
        );
      } else {
        const created = await createMut.mutateAsync({ ...payload, status: "active" });
        // "Pacote de aulas": vende o pacote ao aluno recem-criado (sem plano).
        // Se a venda falhar, o aluno fica salvo e o pacote sai depois pelo menu.
        let packageSold = false;
        if (isPackageSale(values) && values.packageId) {
          try {
            await sellPackageMut.mutateAsync({
              studentId: created.id,
              packageId: values.packageId,
              priceCents: Math.round(values.packagePriceCents ?? 0),
              installments: Number(values.packageInstallments || 1),
              firstDueDate: values.packageFirstDueDate || todayDateISO(),
            });
            packageSold = true;
          } catch (error) {
            toast.error(
              `Aluno criado, mas o pacote não foi vendido. ${getErrorMessage(error, "Venda pelo menu do aluno.")}`,
            );
          }
        }
        const canWelcome = isClasses && whatsapp.ready && Boolean(whatsappNumber(created.phone));
        // WhatsApp conectado: se o switch de boas-vindas estiver marcado (sendWelcome),
        // no modo oficial saem sozinhas (reviewed: true). No modo assistido continua
        // a ação do toast. Se desmarcado, nada é enviado nem sugerido.
        const autoWelcome = canWelcome && sendWelcome && whatsapp.mode === "official" && whatsapp.enabled("welcome_student");
        if (autoWelcome) {
          whatsapp.send({
            trigger: "welcome_student",
            recipient: { name: created.name, phone: created.phone, clientId: created.id },
            reviewed: true,
          });
        }
        toast.success(
          packageSold
            ? "Aluno criado e pacote vendido."
            : isClasses
              ? "Aluno criado com sucesso."
              : "Cliente criado com sucesso.",
          canWelcome && !autoWelcome && sendWelcome
            ? {
                duration: 10_000,
                action: {
                  label: "Enviar boas-vindas",
                  onClick: () =>
                    whatsapp.send({
                      trigger: "welcome_student",
                      recipient: { name: created.name, phone: created.phone, clientId: created.id },
                    }),
                },
              }
            : undefined,
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

  const FormBodyWrapper = isPage ? "div" : DialogBody;

  return (
    <FormProvider {...form}>
      {duplicateDialog}
      {planSwitchDialog}
      {pauseDialog}
      {pausedChargeDialog}
      <form
        id={formId}
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
        noValidate
        className={cn(
          "flex flex-col min-h-0 flex-1",
          isPage ? "overflow-visible" : "overflow-hidden"
        )}
      >
        <FormBodyWrapper className={isPage ? "space-y-6 p-6" : "space-y-4"}>
          {/* Notificação de boas-vindas pelo WhatsApp (visível no topo para decisão imediata) */}
          {!isEdit && isClasses && whatsapp.ready && whatsapp.enabled("welcome_student") ? (
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 transition-colors">
              <div className="flex items-start gap-3 pr-4">
                <MessageCircle className="mt-0.5 size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="space-y-0.5">
                  <label htmlFor="send-welcome-switch" className="text-sm font-medium text-foreground cursor-pointer">
                    Enviar boas-vindas no WhatsApp
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {whatsapp.mode === "official"
                      ? "Dispara a mensagem automática de boas-vindas da Meta ao criar o aluno."
                      : "Oferece o envio de boas-vindas no WhatsApp após o cadastro."}
                  </p>
                </div>
              </div>
              <Switch
                id="send-welcome-switch"
                checked={sendWelcome}
                onCheckedChange={setSendWelcome}
                disabled={pending}
              />
            </div>
          ) : null}

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
            <DateField<ClientFormValues>
              name="birthDate"
              label="Data de nascimento"
              max={todayDateISO()}
              hint={birthDateHint}
              disabled={pending}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <InputCpf<ClientFormValues>
              name="cpf"
              hint={
                isMinor
                  ? "Menor de idade: a cobrança online usa o CPF do responsável financeiro."
                  : "Usado na cobrança online (Pix e cartão)."
              }
              disabled={pending}
            />
          </div>
        </div>

        {/* Bloco 2: Plano e mensalidade (específico de classes/academia) */}
        {isClasses ? (
          <CollapsibleSection
            title="Plano e mensalidade"
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
                variant="cards"
                disabled={pending}
              />

              {paymentMode === "none" ? (
                <p className="text-xs text-muted-foreground">
                  Sem plano e sem mensalidade. Use para curso, aula avulsa ou experimental.
                </p>
              ) : null}

              {isPackageMode && isEdit ? (
                <div
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/20 p-3"
                  data-testid="client-package-balance"
                >
                  {currentPackage ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{currentPackage.name}</span>
                      <StudentPackageBadge pkg={currentPackage} />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhum pacote em uso.</p>
                  )}
                  {canSellPackage && client?.status === "active" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSellPackageOpen(true)}
                      disabled={pending}
                    >
                      <Ticket className="size-3.5" />
                      Vender pacote
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {isPackageMode && !isEdit && !sellsPackage ? (
                <p className="text-xs text-muted-foreground">
                  Sem plano. Quem cuida das cobranças vende o pacote.
                </p>
              ) : null}

              {isPackageMode && !isEdit && sellsPackage ? (
                <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3">
                  <div className="space-y-1.5">
                    <ComboboxField<ClientFormValues>
                      name="packageId"
                      label="Pacote"
                      placeholder={packageCatalogPending ? "Carregando..." : "Selecione o pacote"}
                      searchPlaceholder="Buscar pacote..."
                      emptyMessage="Nenhum pacote ativo."
                      hint={chosenPackage ? packageFacts(chosenPackage) : undefined}
                      options={packageOptions}
                      required
                      disabled={pending}
                    />
                    {!packageCatalogPending && packageOptions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Nenhum pacote ativo.{" "}
                        <Link
                          href="/classes/plans?tab=packages"
                          className="font-medium text-primary hover:underline"
                        >
                          Criar pacote
                        </Link>
                      </p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <InputCurrency<ClientFormValues>
                      name="packagePriceCents"
                      label="Valor"
                      required
                      disabled={pending}
                    />
                    <SelectField<ClientFormValues>
                      name="packageInstallments"
                      label="Parcelas"
                      options={PACKAGE_INSTALLMENT_OPTIONS}
                      clearable={false}
                      disabled={pending}
                    />
                    <DateField<ClientFormValues>
                      name="packageFirstDueDate"
                      label="1º vencimento"
                      required
                      disabled={pending}
                    />
                  </div>
                  {packageSaleSummary ? (
                    <p className="text-xs text-muted-foreground" data-testid="client-package-summary">
                      {packageSaleSummary}
                    </p>
                  ) : null}
                  {packagePastEnd ? (
                    <p className="text-xs text-amber-700 dark:text-amber-400" data-testid="client-package-past-end">
                      {packagePastEnd}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {isScholarship ? (
                <SegmentedChoiceField<ClientFormValues>
                  name="scholarshipKind"
                  ariaLabel="Tipo de bolsa"
                  options={SCHOLARSHIP_KIND_OPTIONS}
                  disabled={pending}
                />
              ) : null}

              {usesPlan ? (
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

              {asksPastMonths ? (
                <div className="space-y-2" data-testid="client-past-months">
                  <p className="text-sm font-medium text-foreground">Cobrar os meses desde o início?</p>
                  <SegmentedChoiceField<ClientFormValues>
                    name="billPastMonths"
                    ariaLabel="Cobrar os meses desde o início?"
                    options={pastMonthsOptions}
                    disabled={pending}
                  />
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
                      {usesOrgRule ? "Regra do espaço" : "Regra deste aluno"}:{" "}
                      {TIMING_LABEL[billingCalculation.terms.timing]} ·{" "}
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

              {usesPlan && (selectedPlanId || isFullScholarship) ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Semanal e quinzenal de ciclo cheio vencem a cada 7 ou 15 dias
                      desde a matricula: o dia do mes nao vale (antes era pedido a toa). */}
                  {cycleDays ? (
                    <p className="self-center text-xs text-muted-foreground">
                      Vence a cada {cycleDays} dias, contando da matrícula.
                    </p>
                  ) : (
                    <InputNumber<ClientFormValues>
                      name="dueDay"
                      label={isBiweekly ? "Dia do vencimento (1ª quinzena)" : "Dia do vencimento recorrente"}
                      placeholder="10"
                      min={1}
                      max={isBiweekly ? 15 : 31}
                      required
                      disabled={pending}
                      hint={
                        isBiweekly
                          ? `Vence nos dias ${biweeklyDueDay} e ${biweeklyDueDay + 15} de cada mês.`
                          : billingStrategy === "full_cycle"
                            ? "No mês cheio, é o dia de início do ciclo. Dia inexistente cai no último dia do mês."
                            : `Dia do mês das próximas mensalidades (padrão do espaço: ${defaultDueDay}).`
                      }
                    />
                  )}

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
                            hint={selectedPlan ? `Máximo: ${formatCents(selectedPlan.priceCents)}.` : undefined}
                            disabled={pending}
                          />
                        )}
                      </div>
                      {discountSummary ? (
                        <p className="text-xs text-muted-foreground">
                          {discountSummary}.{discountWhen}
                        </p>
                      ) : null}
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
                          <p className="text-xs text-muted-foreground">
                            {partialSummary}.{discountWhen}
                          </p>
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
                        ? "Depois dessa data, deixa de aparecer em Cobranças."
                        : "Depois dessa data, volta ao valor cheio do plano."
                    }
                    disabled={pending}
                  />
                </div>
              ) : null}

              {/* Pix Automatico: so para o plano ja salvo do aluno */}
              {usesPlan && isEdit && client?.planId && selectedPlanId === client.planId ? (
                <RecurringAuthorizationSection
                  studentId={client.id}
                  studentName={client.name}
                  planPriceCents={plans?.find((p) => p.id === client.planId)?.priceCents}
                />
              ) : null}
            </div>
          </CollapsibleSection>
        ) : null}

        {/* Responsáveis (opcional, só turmas ou menor de idade): recolhido por padrão */}
        {isClasses || (age !== null && age < 18) ? (
          <CollapsibleSection
            title="Responsáveis (opcional)"
            icon={<Users className="h-4 w-4" />}
            badge={guardiansBadge}
            open={guardiansOpen}
            onOpenChange={setGuardiansUserToggled}
          >
            <div className="space-y-4">
              {age !== null && age < 18 ? (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-foreground">
                        Consentimento de Menor (Art. 14 da LGPD)
                      </h4>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Para alunos menores de 18 anos, a LGPD orienta a coleta de consentimento de ao menos um dos pais ou responsável legal. A ausência de aceite não impede a realização de aulas nem a emissão de cobranças.
                      </p>
                    </div>
                  </div>

                  {client?.minorConsentStatus === "confirmed_whatsapp" ? (
                    <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>
                        Autorizado eletronicamente pelo responsável via WhatsApp
                        {client.minorConsentAt ? ` (${dateInSpace(client.minorConsentAt).split("-").reverse().join("/")})` : ""}.
                      </span>
                    </div>
                  ) : client?.minorConsentStatus === "confirmed_paper" ? (
                    <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>
                        Termo físico presencial arquivado na unidade
                        {client.minorConsentAt ? ` (${dateInSpace(client.minorConsentAt).split("-").reverse().join("/")})` : ""}.
                      </span>
                    </div>
                  ) : (
                    <div className="pt-1">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          {...form.register("hasPaperConsent")}
                          className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4"
                        />
                        <div className="text-xs">
                          <span className="font-medium text-foreground">
                            O responsável já assinou o termo físico presencialmente
                          </span>
                          <p className="text-muted-foreground text-[11px] leading-relaxed">
                            Marque se você já coletou o termo impresso assinado. Caso contrário, você poderá enviar o link de autorização por WhatsApp pela ficha do aluno após salvar.
                          </p>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              ) : null}

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
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeGuardian(index)}
                    disabled={pending}
                    aria-label={`Remover responsável ${index + 1}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <div className="space-y-2">
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
                <InputPhone<ClientFormValues>
                  name={`guardians.${index}.phone`}
                  label="Telefone (WhatsApp)"
                  disabled={pending}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InputText<ClientFormValues>
                    name={`guardians.${index}.email`}
                    type="email"
                    label="E-mail"
                    placeholder="Informe o e-mail (opcional)"
                    disabled={pending}
                  />
                  <InputCpf<ClientFormValues> name={`guardians.${index}.cpf`} disabled={pending} />
                </div>
                <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                  <Checkbox
                    checked={Boolean(guardianValues?.[index]?.financial)}
                    onCheckedChange={(checked) => setFinancialGuardian(index, checked === true)}
                    disabled={pending}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="font-medium text-foreground">Responsável financeiro</span>
                    <span className="block text-xs text-muted-foreground">
                      Paga as cobranças online do aluno menor de idade.
                    </span>
                  </span>
                </label>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                appendGuardian({ name: "", relationship: "", phone: "", email: "", cpf: "", financial: false })
              }
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
            maxLength={NOTES_MAX}
            disabled={pending}
          />
        </CollapsibleSection>
        </FormBodyWrapper>

        {isPage ? (
          <div className="sticky bottom-0 z-20 border-t border-border/60 bg-background/95 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-end gap-3 shadow-lg rounded-b-xl">
            {onCancel && (
              <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={pending}>
              {pending
                ? "Salvando..."
                : isEdit
                  ? "Salvar"
                  : "Adicionar"}
            </Button>
          </div>
        ) : (
          <DialogFooter className="p-6 pt-4 border-t border-border/40 shrink-0 bg-background">
            {onCancel ? (
              <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
                Cancelar
              </Button>
            ) : (
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={pending}>
                  Cancelar
                </Button>
              </DialogClose>
            )}
            <Button type="submit" disabled={pending}>
              {pending
                ? "Salvando..."
                : isEdit
                  ? "Salvar"
                  : "Adicionar"}
            </Button>
          </DialogFooter>
        )}
      </form>
      {/* Fora do <form>: o envio do formulario da venda nao sobe para o do aluno. */}
      {isEdit && canSellPackage ? (
        <SellPackageDialog
          open={sellPackageOpen}
          onOpenChange={setSellPackageOpen}
          student={client ?? null}
          initialPackageId={currentPackage?.packageId}
        />
      ) : null}
    </FormProvider>
  );
}

