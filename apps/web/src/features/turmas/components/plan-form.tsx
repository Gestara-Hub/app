"use client";

import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  DialogFormFooter,
  InputCurrency,
  InputText,
  SelectField,
} from "@/components/form";
import { handleFormApiError } from "@/lib/form-errors";
import type { CreatePlan, PlanPeriod, Plan } from "@gestarahub/contracts";
import { useCurrentUser } from "@/features/auth";
import { useCreatePlan, useUpdatePlan } from "../hooks/use-billing";

const schema = z.object({
  name: z.string().trim().min(1, "Informe o nome do plano."),
  period: z.enum(["monthly", "biweekly", "weekly"]),
  priceCents: z
    .number({ error: "Informe um valor válido." })
    .int("Informe um valor válido.")
    .min(0, "Informe um valor válido."),
});
type PlanFormValues = z.infer<typeof schema>;

const PERIOD_OPTIONS = [
  { label: "Mensal", value: "monthly" },
  { label: "Quinzenal", value: "biweekly" },
  { label: "Semanal", value: "weekly" },
];

export function PlanForm({
  plan,
  formId,
  onSuccess,
}: {
  plan?: Plan;
  formId: string;
  onSuccess: () => void;
  }) {
  const createMut = useCreatePlan();
  const updateMut = useUpdatePlan();
  const isEdit = Boolean(plan);
  const pending = createMut.isPending || updateMut.isPending;
  const user = useCurrentUser();

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: plan
      ? {
          name: plan.name,
          period: (plan.period || "monthly") as PlanPeriod,
          priceCents: plan.priceCents,
        }
      : { name: "", period: "monthly", priceCents: 0 },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const payload: CreatePlan = {
      organizationId: user.organizationId,
      name: values.name,
      period: values.period,
      priceCents: values.priceCents,
      status: plan?.status ?? "active",
    };
    try {
      if (isEdit && plan) {
        await updateMut.mutateAsync({ id: plan.id, payload });
        toast.success("Plano atualizado.");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Plano criado.");
      }
      onSuccess();
    } catch (error) {
      handleFormApiError(error, form, "Não foi possível salvar o plano.");
    }
  });

  return (
    <FormProvider {...form}>
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        <InputText<PlanFormValues>
          name="name"
          label="Nome"
          placeholder="Ex.: Mensal 2x/semana"
          required
          disabled={pending}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField<PlanFormValues>
            name="period"
            label="Periodicidade"
            options={PERIOD_OPTIONS}
            required
            disabled={pending}
          />
          <InputCurrency<PlanFormValues>
            name="priceCents"
            label="Valor"
            required
            disabled={pending}
          />
        </div>
        <DialogFormFooter
          isPending={pending}
          isEdit={isEdit}
          createLabel="Criar plano"
          editLabel="Salvar"
        />
      </form>
    </FormProvider>
  );
}
