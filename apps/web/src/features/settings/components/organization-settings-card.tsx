"use client";

import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { InputPhone, InputText } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/api-error";
import type { Organization, Unit } from "@/types";
import {
  useOrganization,
  useUnit,
  useUpdateOrganization,
  useUpdateUnit,
} from "../hooks/use-settings";

const schema = z.object({
  organizationName: z.string().trim().min(1, "Informe o nome da organização."),
  unitName: z.string().trim().min(1, "Informe o nome da unidade."),
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
      address: unit.address ?? "",
      phone: unit.phone ?? "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateOrg.mutateAsync({ name: values.organizationName });
      await updateUnit.mutateAsync({
        name: values.unitName,
        address: values.address ?? "",
        phone: values.phone ?? "",
      });
      toast.success("Configurações salvas.");
      form.reset(values);
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível salvar as configurações."));
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
        <InputPhone<OrgUnitValues> name="phone" label="Telefone" disabled={pending} />
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

export function OrganizationSettingsCard() {
  const orgQuery = useOrganization();
  const unitQuery = useUnit();
  const loading = orgQuery.isPending || unitQuery.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Organização e unidade</CardTitle>
        <CardDescription>Dados gerais exibidos no sistema.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading || !orgQuery.data || !unitQuery.data ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <OrgUnitForm organization={orgQuery.data} unit={unitQuery.data} />
        )}
      </CardContent>
    </Card>
  );
}
