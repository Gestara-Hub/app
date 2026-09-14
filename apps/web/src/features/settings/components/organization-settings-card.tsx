"use client";

import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { InputPhone, InputText, SelectField } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type { OperationalModel, Organization, Unit } from "@gestarahub/contracts";
import {
  useOrganization,
  useUnit,
  useUpdateOrganization,
  useUpdateUnit,
} from "../hooks/use-settings";

const schema = z.object({
  organizationName: z.string().trim().min(1, "Informe o nome da organização."),
  unitName: z.string().trim().min(1, "Informe o nome da unidade."),
  segment: z.string().trim().optional(),
  model: z.enum(["scheduling", "classes"]),
  address: z.string().optional(),
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
      address: unit.address ?? "",
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
      });
      await updateUnit.mutateAsync({
        name: values.unitName,
        address: values.address ?? "",
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
      <form onSubmit={onSubmit} noValidate className="space-y-4">
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
            placeholder="Ex: Idiomas, Cursos, Barbearia, Academia, Studio..."
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
        <InputText<OrgUnitValues>
          name="unitName"
          label="Nome da unidade"
          required
          disabled={pending}
        />
        <InputText<OrgUnitValues>
          name="address"
          label="Endereço"
          placeholder="Rua, número - bairro"
          disabled={pending}
        />
        <InputPhone<OrgUnitValues>
          name="phone"
          label="Telefone"
          disabled={pending}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
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
