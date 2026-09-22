"use client";

import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AddressFields, InputNumber, InputPhone, InputText, SelectField } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type { Address, OperationalModel, Organization, Unit } from "@gestarahub/contracts";
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
  organizationName: z.string().trim().min(1, "Informe o nome da organização."),
  unitName: z.string().trim().min(1, "Informe o nome da unidade."),
  segment: z.string().trim().optional(),
  model: z.enum(["scheduling", "classes"]),
  defaultDueDay: z
    .number({ error: "Informe o dia de vencimento padrão (1 a 31)." })
    .int("Dia de vencimento deve ser um número inteiro.")
    .min(1, "Dia deve ser entre 1 e 31.")
    .max(31, "Dia deve ser entre 1 e 31."),
  address: addressSchema.optional(),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || v.replace(/\D/g, "").length >= 10, {
      message: "Telefone inválido.",
    }),
});
type OrgUnitValues = z.infer<typeof schema>;

const MODEL_OPTIONS: { value: OperationalModel; label: string }[] = [
  {
    value: "scheduling",
    label: "Atendimento individual (Agenda — Barbearia, Salão, Estética)",
  },
  {
    value: "classes",
    label: "Turmas e aulas coletivas (Grade — Cursos, Idiomas, Dança, Academias, Studios)",
  },
];

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
      segment: organization.segment ?? "",
      model: (organization.model === "delivery" ? "scheduling" : organization.model) as "scheduling" | "classes",
      defaultDueDay: organization.settings?.defaultDueDay ?? 10,
      address: parseUnitAddress(unit.address),
      phone: unit.phone ?? "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const modelChanged = values.model !== organization.model;
      await updateOrg.mutateAsync({
        name: values.organizationName,
        segment: values.segment,
        model: values.model,
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

      if (modelChanged && typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Não foi possível salvar as configurações."),
      );
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">Identificação do Negócio</h3>
          <InputText<OrgUnitValues>
            name="organizationName"
            label="Nome da organização"
            required
            disabled={pending}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputText<OrgUnitValues>
              name="segment"
              label="Segmento / Ramo"
              placeholder="Ex: Lutas, Idiomas, Cursos, Barbearia, Academia, Studio..."
              disabled={pending}
            />
            <SelectField<OrgUnitValues>
              name="model"
              label="Modelo operacional"
              options={MODEL_OPTIONS}
              required
              disabled={pending}
            />
          </div>
        </div>

        <div className="space-y-4 pt-2 border-t">
          <h3 className="text-sm font-medium text-foreground">Regras Financeiras</h3>
          <div className="max-w-xs">
            <InputNumber<OrgUnitValues>
              name="defaultDueDay"
              label="Dia padrão de vencimento"
              hint="Dia do mês (1 a 31) usado como padrão ao matricular novos alunos."
              min={1}
              max={31}
              required
              disabled={pending}
            />
          </div>
        </div>

        <div className="space-y-4 pt-2 border-t">
          <h3 className="text-sm font-medium text-foreground">Dados da Unidade</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputText<OrgUnitValues>
              name="unitName"
              label="Nome da unidade"
              required
              disabled={pending}
            />
            <InputPhone<OrgUnitValues>
              name="phone"
              label="Telefone da unidade"
              disabled={pending}
            />
          </div>

          <div className="pt-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Endereço da Unidade
            </h4>
            <AddressFields<OrgUnitValues> prefix="address" disabled={pending} />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Salvar alterações"}
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
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  return <OrgUnitForm organization={orgQuery.data} unit={unitQuery.data} />;
}
