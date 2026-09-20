"use client";

import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Building2,
  CalendarDays,
  Info,
  Loader2,
  MapPin,
  Save,
} from "lucide-react";
import {
  AddressFields,
  InputNumber,
  InputPhone,
  InputText,
} from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  // Se for string legado, joga no logradouro
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
      phone: unit.phone ?? "",
      address: parseUnitAddress(unit.address),
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateOrg.mutateAsync({
        name: values.organizationName,
        settings: {
          ...organization.settings,
          defaultDueDay: values.defaultDueDay,
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
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        {/* Card 1: Identificação do Negócio */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base">Dados do Negócio</CardTitle>
                <CardDescription>
                  Nome principal exibido para alunos, em comprovantes e relatórios.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <InputText<OrgUnitValues>
              name="organizationName"
              label="Nome da organização / academia"
              placeholder="Ex: Academia Gracie Barra, Studio Pilates..."
              required
              disabled={pending}
            />
          </CardContent>
        </Card>

        {/* Card 2: Unidade & Contato */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPin className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base">Unidade & Contato</CardTitle>
                <CardDescription>
                  Identificação da sede física e canais para os alunos e clientes entrarem em contato.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InputText<OrgUnitValues>
                name="unitName"
                label="Nome da unidade"
                placeholder="Ex: Matriz, Unidade Centro..."
                required
                disabled={pending}
              />
              <InputPhone<OrgUnitValues>
                name="phone"
                label="Telefone de contato"
                placeholder="(11) 99999-9999"
                disabled={pending}
              />
            </div>

            <div className="space-y-3 pt-3 border-t border-border/50">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Endereço da Unidade
              </h4>
              <AddressFields<OrgUnitValues> prefix="address" disabled={pending} />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Regras Financeiras */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarDays className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base">Regras de Cobrança</CardTitle>
                <CardDescription>
                  Configurações financeiras padrão para matrículas e planos de acesso.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 items-start">
              <div>
                <InputNumber<OrgUnitValues>
                  name="defaultDueDay"
                  label="Dia padrão de vencimento"
                  min={1}
                  max={31}
                  required
                  disabled={pending}
                />
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3.5 flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed">
                <Info className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold text-foreground">Vencimento sugerido:</strong>
                  <p className="mt-0.5">
                    Este dia virá pré-preenchido automaticamente na matrícula de novos alunos ou ao gerar cobranças. Você ainda poderá alterá-lo individualmente para cada aluno.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rodapé com botão de ação */}
        <div className="flex items-center justify-between pt-2">
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
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return <OrgUnitForm organization={orgQuery.data} unit={unitQuery.data} />;
}
