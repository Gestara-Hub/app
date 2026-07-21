"use client";

import { useForm, FormProvider, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { InputCurrency, InputText } from "@/components/form";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import type { CreatePlano, Plano } from "@gestarahub/contracts";
import { useCurrentUser } from "@/features/auth";
import { useCreatePlan, useUpdatePlan } from "../hooks/use-billing";

const schema = z.object({
  name: z.string().trim().min(1, "Informe o nome do plano."),
  priceCents: z.number().int().min(0, "Informe um valor válido."),
});
type PlanFormValues = z.infer<typeof schema>;

export function PlanForm({
  plan,
  formId,
  onSuccess,
}: {
  plan?: Plano;
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
      ? { name: plan.name, priceCents: plan.priceCents }
      : { name: "", priceCents: 0 },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const payload: CreatePlano = {
      organizationId: user.organizationId,
      name: values.name,
      priceCents: values.priceCents,
      period: "monthly",
      status: "active",
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
      const fields = getFieldErrors(error);
      if (fields && fields.length > 0) {
        for (const f of fields) {
          form.setError(f.field as Path<PlanFormValues>, { message: f.message });
        }
      } else {
        toast.error(getErrorMessage(error, "Não foi possível salvar o plano."));
      }
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
        <InputCurrency<PlanFormValues>
          name="priceCents"
          label="Valor mensal"
          required
          disabled={pending}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : isEdit ? "Salvar" : "Criar plano"}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}
