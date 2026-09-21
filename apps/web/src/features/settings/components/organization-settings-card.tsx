"use client";

import { useForm, FormProvider, useWatch } from "react-hook-form";
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
  AddressFields,
  InputNumber,
  InputPhone,
  InputText,
} from "@/components/form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  const currentTiming = useWatch({ control: form.control, name: "billingTiming" });
  const currentStrategy = useWatch({ control: form.control, name: "midMonthStrategy" });

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
  });

  return (
    <FormProvider {...form}>
      <form
        onSubmit={onSubmit}
        noValidate
        className="rounded-xl border border-border/70 bg-card p-6 sm:p-7 shadow-xs space-y-7"
      >
        {/* Seção 1: Identificação da Empresa & Unidade */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Building2 className="size-4" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">
                Identificação do Negócio
              </h3>
            </div>
          </div>

          <div className="space-y-4 pt-1">
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
          </div>
        </div>

        {/* Seção 2: Endereço da Unidade */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <MapPin className="size-4" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">
                Endereço da Unidade
              </h3>
            </div>
          </div>

          <div className="pt-1">
            <AddressFields<OrgUnitValues> prefix="address" disabled={pending} />
          </div>
        </div>

        {/* Seção 3: Regras de Cobrança (específico para turmas e mensalidades) */}
        {isClasses ? (
          <div data-tour="settings-billing-rules" className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border/50">
              <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <CalendarDays className="size-4" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">
                  Regras de Cobrança das Mensalidades
                </h3>
                <p className="text-xs text-muted-foreground">
                  Defina o padrão da sua academia. Ele será aplicado automaticamente nas matrículas para evitar erros no balcão.
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-1">
              {/* Opção 1: Regime de Pagamento */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <CreditCard className="size-3.5 text-primary" />
                  Regime de pagamento padrão
                </label>
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
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2.5 rounded-full shrink-0",
                          currentTiming === "prepaid" ? "bg-primary" : "bg-muted-foreground/30",
                        )}
                      />
                      <span className="text-xs font-semibold text-foreground">
                        No ato da matrícula (Pré-pago)
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5 pl-4.5 leading-relaxed">
                      O aluno paga antes para ter o acesso liberado. É o modelo mais comum em estúdios e academias.
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
                        Ao final do período (Pós-pago)
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5 pl-4.5 leading-relaxed">
                      O aluno cursa as aulas primeiro e a mensalidade vence ao término do mês ou ciclo de aulas.
                    </p>
                  </button>
                </div>
              </div>

              {/* Opção 2: Matrículas no meio do mês */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <RotateCcw className="size-3.5 text-primary" />
                  Matrículas no meio do mês
                </label>
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
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2.5 rounded-full shrink-0",
                          currentStrategy === "prorated" ? "bg-primary" : "bg-muted-foreground/30",
                        )}
                      />
                      <span className="text-xs font-semibold text-foreground">
                        Cobrar proporcional (Pró-rata)
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5 pl-4.5 leading-relaxed">
                      Calcula os dias restantes no mês de entrada e alinha todos os próximos vencimentos ao dia padrão da casa.
                    </p>
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
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2.5 rounded-full shrink-0",
                          currentStrategy === "full_cycle" ? "bg-primary" : "bg-muted-foreground/30",
                        )}
                      />
                      <span className="text-xs font-semibold text-foreground">
                        Ciclo corrido de 30 dias
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5 pl-4.5 leading-relaxed">
                      Inicia um ciclo integral de 30 dias a partir da data de matrícula, fixando o vencimento recorrente no dia do início.
                    </p>
                  </button>
                </div>
              </div>

              {/* Opção 3: Dia de vencimento padrão */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="space-y-0.5">
                  <span className="text-sm font-medium text-foreground">
                    Dia de vencimento padrão
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Dia do mês sugerido para os vencimentos recorrentes (usado nas cobranças proporcionais).
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
            </div>
          </div>
        ) : null}

        {/* Rodapé de Ação */}
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
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
