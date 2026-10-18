"use client";

import { isPossiblePhone } from "@gestarahub/core/phone";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useForm, FormProvider, useFormState, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Building2,
  CalendarDays,
  Check,
  Loader2,
  MapPin,
  Save,
  Sparkles,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AddressFields,
  InputNumber,
  InputPhone,
  InputText,
  SegmentedChoiceField,
  SelectField,
  type SegmentedChoiceOption,
  type SelectOption,
} from "@/components/form";
import {
  CLASSES_SEGMENT_PRESETS,
  CUSTOM_BILLING_OPTIONS,
  CUSTOM_PROGRESSION_OPTIONS,
  DEFAULT_CLASS_SEGMENT,
  DEFAULT_CUSTOM_BILLING,
  DEFAULT_CUSTOM_PROGRESSION,
} from "@/lib/business-segment-presets";
import { Button } from "@/components/ui/button";
import { useAttentionUntilInteraction } from "@/lib/use-attention-until-interaction";
import { cn } from "@/lib/utils";
import { SectionSpotlight } from "@/components/shared/section-spotlight";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPhone } from "@gestarahub/core/format";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type {
  Address,
  ClassBillingMode,
  ClassesBusinessSegment,
  CustomSegmentProgression,
  Organization,
  Unit,
} from "@gestarahub/contracts";
import {
  useBusinessSegment,
  useOrganization,
  useUnit,
  useUpdateOrganization,
  useUpdateUnit,
} from "../hooks/use-settings";
import { BillingRulesPreview } from "./billing-rules-preview";
import { UnsavedChangesStatus, useReportDirty } from "./unsaved-changes";

const addressSchema = z.object({
  postalCode: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

const MAX_DEFAULT_DUE_DAY = 31;

const schema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(1, "Informe o nome do espaço.")
    .max(80, "Use até 80 caracteres."),
  unitName: z.string().trim().max(80, "Use até 80 caracteres.").optional(),
  // 29 a 31 caem no ultimo dia dos meses mais curtos.
  defaultDueDay: z
    .number({ error: "Use um dia de 1 a 31." })
    .int("Use um dia de 1 a 31.")
    .min(1, "Use um dia de 1 a 31.")
    .max(MAX_DEFAULT_DUE_DAY, "Use um dia de 1 a 31."),
  billingTiming: z.enum(["prepaid", "postpaid"]),
  midMonthStrategy: z.enum(["prorated", "full_cycle"]),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || isPossiblePhone(v), {
      message: "Telefone inválido.",
    }),
  address: addressSchema.optional(),
  classSegment: z.enum(
    Object.keys(CLASSES_SEGMENT_PRESETS) as [ClassesBusinessSegment, ...ClassesBusinessSegment[]],
  ),
  customSegmentName: z.string().trim().optional(),
  customSegmentProgression: z.enum(
    CUSTOM_PROGRESSION_OPTIONS.map((o) => o.value) as [CustomSegmentProgression, ...CustomSegmentProgression[]],
  ),
  customSegmentBilling: z.enum(
    CUSTOM_BILLING_OPTIONS.map((o) => o.value) as [ClassBillingMode, ...ClassBillingMode[]],
  ),
}).superRefine((values, ctx) => {
  if (values.classSegment === "custom" && !values.customSegmentName) {
    ctx.addIssue({
      code: "custom",
      path: ["customSegmentName"],
      message: "Informe o que você ensina.",
    });
  }
});
type OrgUnitValues = z.infer<typeof schema>;

const CLASS_SEGMENT_OPTIONS: SelectOption[] = Object.values(CLASSES_SEGMENT_PRESETS).map((p) => ({
  value: p.id,
  label: p.label,
}));

const CUSTOM_PROGRESSION_SELECT_OPTIONS: SelectOption[] = CUSTOM_PROGRESSION_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

const CUSTOM_BILLING_SELECT_OPTIONS: SelectOption[] = CUSTOM_BILLING_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

const BILLING_TIMING_OPTIONS: SegmentedChoiceOption[] = [
  { value: "prepaid", label: "Antecipado", description: "Paga antes das aulas" },
  { value: "postpaid", label: "Depois do uso", description: "Paga ao fim do período" },
];

const MID_MONTH_STRATEGY_OPTIONS: SegmentedChoiceOption[] = [
  { value: "prorated", label: "Proporcional", description: "Só os dias restantes" },
  { value: "full_cycle", label: "Mês cheio", description: "Vence no dia da matrícula" },
];

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 py-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-center sm:gap-6">
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function parseUnitAddress(addr: Unit["address"]): OrgUnitValues["address"] {
  if (!addr) {
    return {
      postalCode: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
    };
  }
  if (typeof addr === "object") {
    return {
      postalCode: addr.postalCode ?? "",
      street: addr.street ?? "",
      number: addr.number ?? "",
      complement: addr.complement ?? "",
      neighborhood: addr.neighborhood ?? "",
      city: addr.city ?? "",
      state: addr.state ?? "",
    };
  }
  return {
    postalCode: "",
    street: addr,
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
  };
}

/**
 * Ancoras do hash. Tolera hash repetido (`#billing-rules#billing-rules`), que o
 * roteador do Next ja produziu em navegacoes seguidas para o mesmo destino.
 */
export function hashTargets(hash: string): string[] {
  return hash.split("#").filter(Boolean);
}

function OrgUnitForm({
  organization,
  unit,
  onDirtyChange,
}: {
  organization: Organization;
  unit: Unit;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const updateOrg = useUpdateOrganization();
  const updateUnit = useUpdateUnit();
  const pending = updateOrg.isPending || updateUnit.isPending;

  const form = useForm<OrgUnitValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      organizationName: organization.name,
      unitName: unit.name,
      defaultDueDay: Math.min(organization.settings?.defaultDueDay ?? 10, MAX_DEFAULT_DUE_DAY),
      billingTiming: organization.settings?.billingTiming ?? "prepaid",
      midMonthStrategy: organization.settings?.midMonthStrategy ?? "prorated",
      phone: unit.phone ?? "",
      address: parseUnitAddress(unit.address),
      classSegment: organization.classSegment ?? DEFAULT_CLASS_SEGMENT,
      customSegmentName: organization.customSegmentName ?? "",
      customSegmentProgression: organization.customSegmentProgression ?? DEFAULT_CUSTOM_PROGRESSION,
      customSegmentBilling: organization.customSegmentBilling ?? DEFAULT_CUSTOM_BILLING,
    },
  });
  const dueDayError = useFormState({ control: form.control, name: "defaultDueDay" }).errors.defaultDueDay?.message;

  const isClasses = organization.model === "classes";
  const hasBusinessHours = Boolean(
    unit.businessHours?.some((day) => !day.closed),
  );
  // Regras da mensalidade so pedem confirmacao em area de mensalidade (curso,
  // pacote e sem cobranca nao usam). Pendente nao e alteracao nao salva.
  const usesMembership = useBusinessSegment().defaultBillingMode === "membership";
  const isBillingUnconfirmed =
    isClasses && usesMembership && hasBusinessHours && !organization.settings?.billingTiming;
  useReportDirty(form.formState.isDirty, onDirtyChange);

  // Watch fields para compor resumos dinâmicos nas barras dos accordions
  const orgName = useWatch({ control: form.control, name: "organizationName" });
  const unitName = useWatch({ control: form.control, name: "unitName" });
  const phone = useWatch({ control: form.control, name: "phone" });
  const classSegment = useWatch({ control: form.control, name: "classSegment" });

  const street = useWatch({ control: form.control, name: "address.street" });
  const number = useWatch({ control: form.control, name: "address.number" });
  const neighborhood = useWatch({ control: form.control, name: "address.neighborhood" });
  const city = useWatch({ control: form.control, name: "address.city" });
  const state = useWatch({ control: form.control, name: "address.state" });

  const currentTiming = useWatch({ control: form.control, name: "billingTiming" });
  const currentStrategy = useWatch({ control: form.control, name: "midMonthStrategy" });
  const currentDueDay = useWatch({ control: form.control, name: "defaultDueDay" });

  const formattedPhone = phone ? formatPhone(phone) : null;
  const businessSummary =
    [orgName, unitName, formattedPhone].filter(Boolean).join(" · ") ||
    "Nome, unidade e contato";

  const streetPart = street ? `${street}${number ? `, ${number}` : ""}` : "";
  const areaPart = neighborhood || (city ? `${city}${state ? ` - ${state}` : ""}` : "");
  const addressSummary =
    [streetPart, areaPart].filter(Boolean).join(" · ") ||
    "Endereço e localização da unidade";

  const timingSummary = currentTiming === "postpaid" ? "Depois do uso" : "Antecipado";
  const strategySummary = currentStrategy === "full_cycle" ? "Mês cheio" : "Proporcional";
  const isValidDueDay =
    Number.isInteger(currentDueDay) && currentDueDay >= 1 && currentDueDay <= MAX_DEFAULT_DUE_DAY;
  const dueSummary =
    currentStrategy === "full_cycle"
      ? "Vence no dia da entrada"
      : `Vence todo dia ${isValidDueDay ? currentDueDay : 10}`;
  const billingSummary = `${timingSummary} · ${strategySummary} · ${dueSummary}`;

  // Só expande e destaca automaticamente as regras da mensalidade na etapa guiada do onboarding
  // (ou seja, quando o passo de cobrança ainda estiver pendente de confirmação).
  const shouldFocusBilling =
    isBillingUnconfirmed &&
    typeof window !== "undefined" &&
    hashTargets(window.location.hash).includes("billing-rules");

  const [openSections, setOpenSections] = useState<string[]>(() => {
    if (shouldFocusBilling) {
      return ["billing"];
    }
    return ["business"];
  });

  // O painel fica montado nas outras abas, e a navegacao do Next (ex.: o
  // "Continuar" do onboarding vindo de Horarios) troca a URL via pushState, sem
  // disparar `hashchange`. Por isso reage tambem a troca dos search params.
  const searchParams = useSearchParams();
  // Chegou pelo deep-link (ex.: onboarding): o cartao pulsa sem parar ate o
  // usuario tocar, focar ou abrir algo nele. Cada chegada rearma o pulso.
  const [billingArrival, setBillingArrival] = useState(0);
  const billingAttention = useAttentionUntilInteraction(
    isBillingUnconfirmed && billingArrival > 0,
    billingArrival,
  );
  // O botao de confirmar pulsa ate o clique enquanto as regras nao foram confirmadas.
  const confirmAttention = useAttentionUntilInteraction(isBillingUnconfirmed, "billing-confirm");
  const billingSectionRef = useRef<HTMLDivElement>(null);
  // Destaque cobre a secao e o rodape com "Confirmar regras recomendadas".
  const formFooterRef = useRef<HTMLDivElement>(null);
  const billingSpotlightRefs = useMemo(() => [billingSectionRef, formFooterRef], []);
  useEffect(() => {
    let timer: number | undefined;
    const handleHash = () => {
      if (!isBillingUnconfirmed) return;
      if (!hashTargets(window.location.hash).includes("billing-rules")) return;
      setOpenSections(["billing"]);
      setBillingArrival((n) => n + 1);
      window.clearTimeout(timer);
      // Aguarda a animacao de abertura do acordeao (200ms) concluir para ter a altura real da pagina
      timer = window.setTimeout(() => {
        const el = document.getElementById("billing-rules");
        if (!el || el.closest("[hidden]")) return;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 280);
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", handleHash);
    };
  }, [searchParams, isBillingUnconfirmed]);

  const onError = (errors: FieldErrors<OrgUnitValues>) => {
    const toOpen: string[] = [];
    if (
      errors.organizationName ||
      errors.unitName ||
      errors.phone ||
      errors.classSegment ||
      errors.customSegmentName ||
      errors.customSegmentProgression ||
      errors.customSegmentBilling
    ) {
      toOpen.push("business");
    }
    if (errors.address) {
      toOpen.push("address");
    }
    if (errors.billingTiming || errors.midMonthStrategy || errors.defaultDueDay) {
      toOpen.push("billing");
    }
    if (toOpen.length > 0) {
      setOpenSections((prev) => Array.from(new Set([...prev, ...toOpen])));
      toast.error("Revise os campos destacados.");
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    // Grava so o que mudou, para cada salvamento virar um unico evento na auditoria.
    const dirty = form.formState.dirtyFields;
    const segmentDirty = Boolean(
      dirty.classSegment ||
      dirty.customSegmentName ||
      dirty.customSegmentProgression ||
      dirty.customSegmentBilling,
    );
    const orgDirty = Boolean(
      segmentDirty ||
        dirty.organizationName ||
        dirty.defaultDueDay ||
        dirty.billingTiming ||
        dirty.midMonthStrategy ||
        // 1o salvamento grava as regras padrao (o onboarding depende delas).
        !organization.settings?.billingTiming,
    );
    const unitDirty = Boolean(dirty.unitName || dirty.phone || dirty.address);
    try {
      if (orgDirty) {
        const isCustom = values.classSegment === "custom";
        const customName = values.customSegmentName?.trim() ?? "";
        await updateOrg.mutateAsync({
          name: values.organizationName,
          ...(isClasses && segmentDirty
            ? {
                classSegment: values.classSegment,
                customSegmentName: isCustom ? customName : undefined,
                customSegmentProgression: isCustom ? values.customSegmentProgression : undefined,
                customSegmentBilling: isCustom ? values.customSegmentBilling : undefined,
                segment: isCustom ? customName : CLASSES_SEGMENT_PRESETS[values.classSegment].label,
              }
            : {}),
          settings: {
            ...organization.settings,
            defaultDueDay: values.defaultDueDay,
            billingTiming: values.billingTiming,
            midMonthStrategy: values.midMonthStrategy,
          },
        });
      }
      if (unitDirty) {
        await updateUnit.mutateAsync({
          name: values.unitName?.trim() ?? "",
          address: values.address as Address,
          phone: values.phone ?? "",
        });
      }
      toast.success(
        isBillingUnconfirmed
          ? "Regras da mensalidade confirmadas com sucesso."
          : "Configurações salvas.",
      );
      if (typeof window !== "undefined" && window.location.hash) {
        const cleanUrl = `${window.location.pathname}${window.location.search || ""}`;
        window.history.replaceState(null, "", cleanUrl);
      }
      setBillingArrival(0);
      form.reset(values);
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Não foi possível salvar as configurações."),
      );
    }
  }, onError);

  return (
    <FormProvider {...form}>
      <form
        onSubmit={onSubmit}
        noValidate
        className="space-y-4"
      >
        <Accordion
          type="multiple"
          value={openSections}
          onValueChange={setOpenSections}
          className="space-y-3"
        >
          {/* Seção 1: dados do espaço */}
          <AccordionItem
            value="business"
            className="rounded-xl border border-border/70 bg-card px-5 sm:px-6 shadow-xs transition-colors"
          >
            <AccordionTrigger className="py-4 hover:no-underline cursor-pointer">
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="size-4" />
                </div>
                <div className="min-w-0 text-left">
                  <h3 className="font-semibold text-foreground text-sm leading-tight">
                    Dados do espaço
                  </h3>
                  <p className="min-w-0 text-xs text-muted-foreground break-words mt-0.5 font-normal">
                    {businessSummary}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-5 space-y-4 border-t border-border/40 mt-1">
              <InputText<OrgUnitValues>
                name="organizationName"
                label="Nome do espaço"
                placeholder="Informe o nome do espaço"
                required
                disabled={pending}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputText<OrgUnitValues>
                  name="unitName"
                  label="Nome da unidade"
                  placeholder="Informe o nome da unidade"
                  disabled={pending}
                />
                <InputPhone<OrgUnitValues>
                  name="phone"
                  label="Telefone / WhatsApp"
                  placeholder="(11) 99999-9999"
                  disabled={pending}
                />
              </div>

              {isClasses ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SelectField<OrgUnitValues>
                    name="classSegment"
                    label="Área do espaço"
                    hint="Muda padrões de novas turmas e palavras das telas."
                    options={CLASS_SEGMENT_OPTIONS}
                    clearable={false}
                    disabled={pending}
                  />
                  {classSegment === "custom" ? (
                    <>
                      <InputText<OrgUnitValues>
                        name="customSegmentName"
                        label="O que você ensina?"
                        placeholder="Nome da sua área ou atividade"
                        required
                        disabled={pending}
                      />
                      <SelectField<OrgUnitValues>
                        name="customSegmentProgression"
                        label="Como seus alunos avançam?"
                        hint="Muda a trilha sugerida e as palavras das telas."
                        options={CUSTOM_PROGRESSION_SELECT_OPTIONS}
                        clearable={false}
                        disabled={pending}
                      />
                      <SelectField<OrgUnitValues>
                        name="customSegmentBilling"
                        label="Como você cobra?"
                        hint="É só o padrão: cada turma pode cobrar diferente."
                        options={CUSTOM_BILLING_SELECT_OPTIONS}
                        clearable={false}
                        disabled={pending}
                      />
                    </>
                  ) : null}
                </div>
              ) : null}
            </AccordionContent>
          </AccordionItem>

          {/* Seção 2: endereço */}
          <AccordionItem
            value="address"
            className="rounded-xl border border-border/70 bg-card px-5 sm:px-6 shadow-xs transition-colors"
          >
            <AccordionTrigger className="py-4 hover:no-underline cursor-pointer">
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MapPin className="size-4" />
                </div>
                <div className="min-w-0 text-left">
                  <h3 className="font-semibold text-foreground text-sm leading-tight">
                    Endereço
                  </h3>
                  <p className="min-w-0 text-xs text-muted-foreground break-words mt-0.5 font-normal">
                    {addressSummary}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-5 border-t border-border/40 mt-1">
              <AddressFields<OrgUnitValues> prefix="address" disabled={pending} />
            </AccordionContent>
          </AccordionItem>

          {/* Seção 3: Regras da mensalidade (só turmas que cobram mensalidade) */}
          {isClasses ? (
            <AccordionItem
              value="billing"
              id="billing-rules"
              data-tour="settings-billing-rules"
              ref={billingSectionRef}
              className="rounded-xl border border-border/70 bg-card px-5 sm:px-6 shadow-xs transition-colors scroll-mt-20"
            >
              <AccordionTrigger className="py-4 hover:no-underline cursor-pointer">
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CalendarDays className="size-4" />
                  </div>
                  <div className="min-w-0 text-left">
                    <h3 className="font-semibold text-foreground text-sm leading-tight">
                      Regras da mensalidade
                    </h3>
                    <p className="min-w-0 text-xs text-muted-foreground break-words mt-0.5 font-normal">
                      {billingSummary}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-5 border-t border-border/40 mt-1">
                <p className="mt-3 text-xs text-muted-foreground">
                  Só para mensalidades. Curso, pacote e avulso têm valor e vencimento próprios.
                </p>
                {isBillingUnconfirmed ? (
                  <div className="mt-3 mb-2 flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/[0.03] p-3 text-xs text-muted-foreground">
                    <Sparkles className="size-4 shrink-0 text-primary mt-0.5" />
                    <p>
                      Este é o modelo mais comum. Se servir para você, é só confirmar.
                    </p>
                  </div>
                ) : null}
                <div className="divide-y divide-border/40">
                  <SettingRow label="Momento do pagamento" hint="Quando a mensalidade vence.">
                    <SegmentedChoiceField<OrgUnitValues>
                      name="billingTiming"
                      ariaLabel="Momento do pagamento"
                      options={BILLING_TIMING_OPTIONS}
                      disabled={pending}
                    />
                  </SettingRow>
                  <SettingRow label="Entrada no meio do mês" hint="Como fica a 1ª cobrança.">
                    <SegmentedChoiceField<OrgUnitValues>
                      name="midMonthStrategy"
                      ariaLabel="Entrada no meio do mês"
                      options={MID_MONTH_STRATEGY_OPTIONS}
                      disabled={pending}
                    />
                  </SettingRow>
                  <SettingRow
                    label="Dia de vencimento"
                    hint={
                      currentStrategy === "full_cycle"
                        ? "O vencimento ocorre mensalmente na mesma data em que a matrícula foi realizada."
                        : "Todos os alunos vencem no mesmo dia fixo."
                    }
                  >
                    {currentStrategy === "full_cycle" ? (
                      <div className="flex items-center gap-2 py-1 text-sm font-medium text-foreground">
                        <span className="rounded-md border bg-muted/50 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                          Automático (dia da matrícula)
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>Todo dia</span>
                        {/* O erro sai numa linha propria: dentro do campo de 80px
                            quebrava em 3 linhas. */}
                        <div className="w-20 [&_[role=alert]]:hidden">
                          <InputNumber<OrgUnitValues>
                            name="defaultDueDay"
                            min={1}
                            max={MAX_DEFAULT_DUE_DAY}
                            disabled={pending}
                          />
                        </div>
                        <span>de cada mês</span>
                        {dueDayError ? (
                          <span role="alert" className="basis-full text-xs text-destructive">
                            {dueDayError}
                          </span>
                        ) : null}
                        {isValidDueDay && currentDueDay >= 29 ? (
                          <span className="basis-full text-xs">Nos meses mais curtos, vence no último dia.</span>
                        ) : null}
                      </div>
                    )}
                  </SettingRow>
                </div>
                <BillingRulesPreview
                  billingTiming={currentTiming}
                  midMonthStrategy={currentStrategy}
                  defaultDueDay={isValidDueDay ? currentDueDay : 10}
                />
              </AccordionContent>
            </AccordionItem>
          ) : null}
        </Accordion>
        {isClasses ? (
          <SectionSpotlight
            active={billingAttention.attention}
            targetRefs={billingSpotlightRefs}
            onDismiss={billingAttention.stop}
          />
        ) : null}

        {/* Rodapé de Ação */}
        <div ref={formFooterRef} className="flex items-center justify-between pt-2">
          <div>
            {isBillingUnconfirmed && !form.formState.isDirty ? (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                ● Falta confirmar
              </p>
            ) : (
              <UnsavedChangesStatus dirty={form.formState.isDirty} />
            )}
          </div>
          <Button
            type="submit"
            disabled={pending}
            onClick={confirmAttention.stop}
            // Treme de leve e solta o anel, sem crescer: o botao fica dentro do destaque.
            className={cn("min-w-36", confirmAttention.attention && "motion-safe:animate-attention-soft-infinite")}
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Salvando...
              </>
            ) : isBillingUnconfirmed ? (
              // Enquanto o passo esta pendente, salvar tambem confirma as regras:
              // o botao continua dizendo isso, mesmo com alguma regra alterada.
              <>
                <Check className="mr-2 size-4" />
                {form.formState.isDirty ? "Confirmar regras" : "Confirmar regras recomendadas"}
              </>
            ) : (
              <>
                <Save className="mr-2 size-4" />
                Salvar configurações
              </>
            )}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

export function OrganizationSettingsForm({
  onDirtyChange,
}: {
  /** Avisa as abas quando ha alteracoes nao salvas. */
  onDirtyChange?: (dirty: boolean) => void;
} = {}) {
  const orgQuery = useOrganization();
  const unitQuery = useUnit();
  const loading = orgQuery.isPending || unitQuery.isPending;

  if (loading || !orgQuery.data || !unitQuery.data) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-7 space-y-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <OrgUnitForm
      organization={orgQuery.data}
      unit={unitQuery.data}
      onDirtyChange={onDirtyChange}
    />
  );
}
