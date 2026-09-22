"use client";

import { useEffect, useState } from "react";
import { useForm, FormProvider, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Building2,
  CalendarDays,
  CreditCard,
  Loader2,
  MapPin,
  RotateCcw,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
} from "@/components/form";
import { Button } from "@/components/ui/button";
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

const addressSchema = z.object({
  postalCode: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

const schema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(1, "Informe o nome da organização ou academia."),
  unitName: z.string().trim().min(1, "Informe o nome da unidade."),
  defaultDueDay: z
    .number({ error: "Informe o dia de vencimento padrão (1 a 31)." })
    .int("Dia de vencimento deve ser um número inteiro.")
    .min(1, "Dia deve ser entre 1 e 31.")
    .max(31, "Dia deve ser entre 1 e 31."),
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
      defaultDueDay: organization.settings?.defaultDueDay ?? 10,
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

  const timingSummary = currentTiming === "postpaid" ? "Paga depois (Pós-pago)" : "Paga antecipado (Pré-pago)";
  const strategySummary =
    currentStrategy === "full_cycle" ? "Ciclo de 30 dias" : "Cobrança proporcional (pró-rata)";
  const dueSummary =
    currentStrategy === "full_cycle"
      ? "Vencimento no dia da entrada"
      : `Vencimento todo dia ${currentDueDay || 10}`;
  const billingSummary = `${timingSummary} • ${strategySummary} • ${dueSummary}`;

  // Se a URL possuir #billing-rules, abre a seção de regras de cobrança; senão, abre a de identificação
  const [openSections, setOpenSections] = useState<string[]>(() => {
    if (typeof window !== "undefined" && window.location.hash === "#billing-rules") {
      return ["billing"];
    }
    return ["business"];
  });

  useEffect(() => {
    const handleHash = () => {
      if (typeof window !== "undefined" && window.location.hash === "#billing-rules") {
        setOpenSections(["billing"]);
        setTimeout(() => {
          const el = document.getElementById("billing-rules");
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 120);
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

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
      toast.error("Existem campos obrigatórios não preenchidos.");
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateOrg.mutateAsync({
        name: values.organizationName,
        settings: {
          ...organization.settings,
          defaultDueDay: values.defaultDueDay,
          billingTiming: values.billingTiming,
          midMonthStrategy: values.midMonthStrategy,
        },
      });
      await updateUnit.mutateAsync({
        name: values.unitName,
        address: values.address as Address,
        phone: values.phone ?? "",
      });
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
              className="rounded-xl border border-border/70 bg-card px-5 sm:px-6 shadow-xs data-[state=open]:border-primary/40 transition-colors scroll-mt-6"
            >
              <AccordionTrigger className="py-4 hover:no-underline cursor-pointer">
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CalendarDays className="size-4" />
                  </div>
                  <div className="min-w-0 text-left">
                    <h3 className="font-semibold text-foreground text-sm leading-tight">
                      Regras de Cobrança das Mensalidades
                    </h3>
                    <p className="text-xs text-muted-foreground truncate mt-0.5 font-normal">
                      {billingSummary}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-5 space-y-5 border-t border-border/40 mt-1">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Defina como sua academia prefere cobrar as mensalidades. Essas regras serão aplicadas automaticamente nas novas matrículas para evitar erros na recepção.
                </p>

                {/* Opção 1: Quando o aluno paga */}
                <div className="space-y-2 pt-1">
                  <div className="space-y-0.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <CreditCard className="size-3.5 text-primary" />
                      Quando o aluno deve pagar a mensalidade?
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Define se o aluno paga antes de fazer as aulas ou se paga depois de cursar o período.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => form.setValue("billingTiming", "prepaid", { shouldDirty: true })}
                      className={cn(
                        "flex flex-col items-start p-3.5 rounded-lg border text-left transition-all select-none cursor-pointer",
                        currentTiming === "prepaid"
                          ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40 shadow-2xs"
                          : "border-border/60 hover:bg-muted/40 text-muted-foreground",
                      )}
                      disabled={pending}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-2.5 rounded-full shrink-0",
                              currentTiming === "prepaid" ? "bg-primary" : "bg-muted-foreground/30",
                            )}
                          />
                          <span className="text-xs font-semibold text-foreground">
                            Pagar antecipado (Pré-pago)
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-primary bg-primary/10 rounded px-1.5 py-0.5">
                          Padrão
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5 pl-4.5 leading-relaxed">
                        O aluno paga no ato da matrícula para liberar o acesso às aulas.
                      </p>
                      <p className="text-[11px] text-foreground/80 mt-1 pl-4.5 font-medium">
                        💡 Ex: Se entrar dia 05, paga a 1ª mensalidade no dia 05 para ter o mês liberado.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => form.setValue("billingTiming", "postpaid", { shouldDirty: true })}
                      className={cn(
                        "flex flex-col items-start p-3.5 rounded-lg border text-left transition-all select-none cursor-pointer",
                        currentTiming === "postpaid"
                          ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40 shadow-2xs"
                          : "border-border/60 hover:bg-muted/40 text-muted-foreground",
                      )}
                      disabled={pending}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "size-2.5 rounded-full shrink-0",
                            currentTiming === "postpaid" ? "bg-primary" : "bg-muted-foreground/30",
                          )}
                        />
                        <span className="text-xs font-semibold text-foreground">
                          Pagar depois de usar (Pós-pago)
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5 pl-4.5 leading-relaxed">
                        O aluno faz as aulas do mês primeiro e a mensalidade vence ao término do período.
                      </p>
                      <p className="text-[11px] text-foreground/80 mt-1 pl-4.5 font-medium">
                        💡 Ex: Cursa as aulas o mês todo e a fatura vence ao término do ciclo.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Opção 2: Matrículas no meio do mês */}
                <div className="space-y-2">
                  <div className="space-y-0.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <RotateCcw className="size-3.5 text-primary" />
                      Como cobrar quem entra no meio do mês?
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Se um aluno se matricular fora do início do mês (ex: dia 20), como calcular a primeira cobrança?
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => form.setValue("midMonthStrategy", "prorated", { shouldDirty: true })}
                      className={cn(
                        "flex flex-col items-start p-3.5 rounded-lg border text-left transition-all select-none cursor-pointer",
                        currentStrategy === "prorated"
                          ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40 shadow-2xs"
                          : "border-border/60 hover:bg-muted/40 text-muted-foreground",
                      )}
                      disabled={pending}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-2.5 rounded-full shrink-0",
                              currentStrategy === "prorated" ? "bg-primary" : "bg-muted-foreground/30",
                            )}
                          />
                          <span className="text-xs font-semibold text-foreground">
                            Cobrar apenas os dias restantes (Proporcional)
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5 pl-4.5 leading-relaxed">
                        Cobra só pelos dias que faltam para acabar o mês. As próximas faturas vencem todas no dia padrão da academia.
                      </p>
                      <p className="text-[11px] text-foreground/80 mt-1 pl-4.5 font-medium">
                        💡 Ex: Se entrar dia 20 num plano de R$ 150, paga só ~R$ 50 pelos 10 dias restantes.
                      </p>
                      <div className="mt-2 pl-4.5">
                        <span className="text-[10px] text-primary bg-primary/10 rounded px-1.5 py-0.5 font-medium">
                          ⭐ Todos os alunos vencem no mesmo dia
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => form.setValue("midMonthStrategy", "full_cycle", { shouldDirty: true })}
                      className={cn(
                        "flex flex-col items-start p-3.5 rounded-lg border text-left transition-all select-none cursor-pointer",
                        currentStrategy === "full_cycle"
                          ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40 shadow-2xs"
                          : "border-border/60 hover:bg-muted/40 text-muted-foreground",
                      )}
                      disabled={pending}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-2.5 rounded-full shrink-0",
                              currentStrategy === "full_cycle" ? "bg-primary" : "bg-muted-foreground/30",
                            )}
                          />
                          <span className="text-xs font-semibold text-foreground">
                            Cobrar o mês inteiro (Ciclo de 30 dias)
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5 pl-4.5 leading-relaxed">
                        Cobra a mensalidade cheia já na entrada. O período de 30 dias dele passa a contar a partir da data de matrícula.
                      </p>
                      <p className="text-[11px] text-foreground/80 mt-1 pl-4.5 font-medium">
                        💡 Ex: Se entrar dia 20, paga o valor cheio e os próximos vencimentos dele serão sempre todo dia 20.
                      </p>
                      <div className="mt-2 pl-4.5">
                        <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5 font-medium">
                          ⭐ O aluno sempre paga o mês cheio desde o início
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Opção 3: Dia de vencimento padrão */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-foreground">
                      Dia padrão de vencimento
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {currentStrategy === "prorated"
                        ? "Dia do mês em que vencem as mensalidades de todos os alunos (ex: dia 10). Ideal para concentrar recebimentos e simplificar o caixa."
                        : "No ciclo de 30 dias, cada aluno vence no dia em que entrou. Este número será sugerido apenas caso queira ajustar manualmente."}
                    </p>
                  </div>
                  <div className="w-24 shrink-0">
                    <InputNumber<OrgUnitValues>
                      name="defaultDueDay"
                      label=""
                      min={1}
                      max={31}
                      required
                      disabled={pending}
                    />
                  </div>
                </div>
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
