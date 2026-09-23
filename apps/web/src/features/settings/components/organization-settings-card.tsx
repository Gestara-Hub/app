"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useForm, FormProvider, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Building2,
  CalendarDays,
  Loader2,
  MapPin,
  Save,
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
  type SegmentedChoiceOption,
} from "@/components/form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPhone } from "@gestarahub/core/format";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type { Address, Organization, Unit } from "@gestarahub/contracts";
import {
  useOrganization,
  useUnit,
  useUpdateOrganization,
  useUpdateUnit,
} from "../hooks/use-settings";
import { BillingRulesPreview } from "./billing-rules-preview";

const addressSchema = z.object({
  postalCode: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

const MAX_DEFAULT_DUE_DAY = 28;

const schema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(1, "Informe o nome da organização ou academia."),
  unitName: z.string().trim().min(1, "Informe o nome da unidade."),
  // Limitado a 28 para existir em todos os meses, inclusive fevereiro
  defaultDueDay: z
    .number({ error: "Use um dia de 1 a 28." })
    .int("Use um dia de 1 a 28.")
    .min(1, "Use um dia de 1 a 28.")
    .max(MAX_DEFAULT_DUE_DAY, "Use um dia de 1 a 28."),
  billingTiming: z.enum(["prepaid", "postpaid"]),
  midMonthStrategy: z.enum(["prorated", "full_cycle"]),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || v.replace(/\D/g, "").length >= 10, {
      message: "Telefone inválido.",
    }),
  address: addressSchema.optional(),
});
type OrgUnitValues = z.infer<typeof schema>;

const BILLING_TIMING_OPTIONS: SegmentedChoiceOption[] = [
  { value: "prepaid", label: "Antecipado", description: "Paga antes das aulas" },
  { value: "postpaid", label: "Depois do uso", description: "Paga ao fim do período" },
];

const MID_MONTH_STRATEGY_OPTIONS: SegmentedChoiceOption[] = [
  { value: "prorated", label: "Proporcional", description: "Só os dias restantes" },
  { value: "full_cycle", label: "Mês cheio", description: "Ciclo a partir da entrada" },
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
}: {
  organization: Organization;
  unit: Unit;
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
    },
  });

  const isClasses = organization.model === "classes";

  // Watch fields para compor resumos dinâmicos nas barras dos accordions
  const orgName = useWatch({ control: form.control, name: "organizationName" });
  const unitName = useWatch({ control: form.control, name: "unitName" });
  const phone = useWatch({ control: form.control, name: "phone" });

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
    [orgName, unitName, formattedPhone].filter(Boolean).join(" • ") ||
    "Nome da organização, unidade e contato";

  const streetPart = street ? `${street}${number ? `, ${number}` : ""}` : "";
  const areaPart = neighborhood || (city ? `${city}${state ? ` - ${state}` : ""}` : "");
  const addressSummary =
    [streetPart, areaPart].filter(Boolean).join(" • ") ||
    "Endereço e localização da unidade";

  const timingSummary = currentTiming === "postpaid" ? "Depois do uso" : "Antecipado";
  const strategySummary = currentStrategy === "full_cycle" ? "Mês cheio" : "Proporcional";
  const isValidDueDay =
    Number.isInteger(currentDueDay) && currentDueDay >= 1 && currentDueDay <= MAX_DEFAULT_DUE_DAY;
  const dueSummary =
    currentStrategy === "full_cycle"
      ? "Vence no dia da entrada"
      : `Vence todo dia ${isValidDueDay ? currentDueDay : 10}`;
  const billingSummary = `${timingSummary} • ${strategySummary} • ${dueSummary}`;

  // Se a URL possuir #billing-rules, abre a seção de regras de cobrança; senão, abre a de identificação
  const [openSections, setOpenSections] = useState<string[]>(() => {
    if (typeof window !== "undefined" && hashTargets(window.location.hash).includes("billing-rules")) {
      return ["billing"];
    }
    return ["business"];
  });

  // O painel fica montado nas outras abas, e a navegacao do Next (ex.: o
  // "Continuar" do onboarding vindo de Horarios) troca a URL via pushState, sem
  // disparar `hashchange`. Por isso reage tambem a troca dos search params.
  const searchParams = useSearchParams();
  const billingTriggerRef = useRef<HTMLButtonElement>(null);
  // Chegou pelo deep-link (ex.: onboarding): o cartao pulsa ate o usuario clicar nele.
  const [highlightBilling, setHighlightBilling] = useState(false);
  useEffect(() => {
    let timer: number | undefined;
    const handleHash = () => {
      if (!hashTargets(window.location.hash).includes("billing-rules")) return;
      setOpenSections((prev) => (prev.includes("billing") ? prev : [...prev, "billing"]));
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const el = document.getElementById("billing-rules");
        if (!el || el.closest("[hidden]")) return;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        billingTriggerRef.current?.focus({ preventScroll: true });
        setHighlightBilling(true);
      }, 120);
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", handleHash);
    };
  }, [searchParams]);

  const onError = (errors: FieldErrors<OrgUnitValues>) => {
    const toOpen: string[] = [];
    if (errors.organizationName || errors.unitName || errors.phone) {
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
    const orgDirty = Boolean(
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
        await updateOrg.mutateAsync({
          name: values.organizationName,
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
          name: values.unitName,
          address: values.address as Address,
          phone: values.phone ?? "",
        });
      }
      toast.success("Configurações salvas.");
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
          {/* Seção 1: Identificação do Negócio */}
          <AccordionItem
            value="business"
            className="rounded-xl border border-border/70 bg-card px-5 sm:px-6 shadow-xs data-[state=open]:border-primary/40 transition-colors"
          >
            <AccordionTrigger className="py-4 hover:no-underline cursor-pointer">
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="size-4" />
                </div>
                <div className="min-w-0 text-left">
                  <h3 className="font-semibold text-foreground text-sm leading-tight">
                    Identificação do Negócio
                  </h3>
                  <p className="text-xs text-muted-foreground truncate mt-0.5 font-normal">
                    {businessSummary}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-5 space-y-4 border-t border-border/40 mt-1">
              <InputText<OrgUnitValues>
                name="organizationName"
                label="Nome da organização / academia"
                placeholder="Ex: Academia Gracie Barra, Studio Pilates..."
                required
                disabled={pending}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputText<OrgUnitValues>
                  name="unitName"
                  label="Nome da unidade"
                  placeholder="Ex: Matriz, Unidade Centro..."
                  required
                  disabled={pending}
                />
                <InputPhone<OrgUnitValues>
                  name="phone"
                  label="Telefone / WhatsApp"
                  placeholder="(11) 99999-9999"
                  disabled={pending}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Seção 2: Endereço da Unidade */}
          <AccordionItem
            value="address"
            className="rounded-xl border border-border/70 bg-card px-5 sm:px-6 shadow-xs data-[state=open]:border-primary/40 transition-colors"
          >
            <AccordionTrigger className="py-4 hover:no-underline cursor-pointer">
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MapPin className="size-4" />
                </div>
                <div className="min-w-0 text-left">
                  <h3 className="font-semibold text-foreground text-sm leading-tight">
                    Endereço da Unidade
                  </h3>
                  <p className="text-xs text-muted-foreground truncate mt-0.5 font-normal">
                    {addressSummary}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-5 border-t border-border/40 mt-1">
              <AddressFields<OrgUnitValues> prefix="address" disabled={pending} />
            </AccordionContent>
          </AccordionItem>

          {/* Seção 3: Regras de Cobrança (específico para turmas e mensalidades) */}
          {isClasses ? (
            <AccordionItem
              value="billing"
              id="billing-rules"
              data-tour="settings-billing-rules"
              onPointerDownCapture={() => setHighlightBilling(false)}
              className={cn(
                "rounded-xl border border-border/70 bg-card px-5 sm:px-6 shadow-xs data-[state=open]:border-primary/40 transition-colors scroll-mt-6",
                highlightBilling &&
                  "border-primary/60 data-[state=open]:border-primary/60 motion-safe:animate-attention-ring",
              )}
            >
              <AccordionTrigger
                ref={billingTriggerRef}
                className="py-4 hover:no-underline cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CalendarDays className="size-4" />
                  </div>
                  <div className="min-w-0 text-left">
                    <h3 className="font-semibold text-foreground text-sm leading-tight">
                      Regras de Cobrança
                    </h3>
                    <p className="text-xs text-muted-foreground truncate mt-0.5 font-normal">
                      {billingSummary}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-5 border-t border-border/40 mt-1">
                <p className="pt-3 pb-1 text-xs text-muted-foreground">
                  Como as mensalidades são cobradas nas novas matrículas.
                </p>
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
                        ? "Cada aluno vence no dia em que entrou."
                        : "Todos os alunos vencem nesse dia (1 a 28)."
                    }
                  >
                    <div className="sm:w-44">
                      <InputNumber<OrgUnitValues>
                        name="defaultDueDay"
                        min={1}
                        max={MAX_DEFAULT_DUE_DAY}
                        disabled={pending || currentStrategy === "full_cycle"}
                      />
                    </div>
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

        {/* Rodapé de Ação */}
        <div className="flex items-center justify-between p-4 sm:p-5 rounded-xl border border-border/70 bg-card shadow-xs">
          <p className="text-xs text-muted-foreground">
            {form.formState.isDirty ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                ● Alterações não salvas
              </span>
            ) : (
              <span className="text-muted-foreground">
                Todas as alterações estão salvas
              </span>
            )}
          </p>
          <Button type="submit" disabled={pending} className="min-w-36">
            {pending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 size-4" />
                Salvar alterações
              </>
            )}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

export function OrganizationSettingsForm() {
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

  return <OrgUnitForm organization={orgQuery.data} unit={unitQuery.data} />;
}
