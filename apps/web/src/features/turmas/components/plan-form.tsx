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
import { useCreatePlan, useUpdatePlan } from "../hooks/use-billing";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { useClients } from "@/features/clients";
import { DialogBody } from "@/components/ui/dialog";

const schema = z.object({
  name: z.string().trim().min(1, "Informe o nome do plano."),
  period: z.enum(["monthly", "biweekly", "weekly"], { error: "Selecione a periodicidade." }),
  priceCents: z
    .number({ error: "Informe um valor válido." })
    .int("Informe um valor válido.")
    .min(1, "Informe um valor maior que zero."),
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
  onCancel,
}: {
  plan?: Plan;
  formId: string;
  onSuccess: () => void;
  onCancel?: () => void;
}) {
  const createMut = useCreatePlan();
  const updateMut = useUpdatePlan();
  const isEdit = Boolean(plan);
  // Mudar o valor de um plano em uso diz para quem vale antes de salvar.
  const { data: activeClients } = useClients({ status: "active" }, isEdit);
  const { confirm, dialog: confirmDialog } = useConfirmAction();
  const pending = createMut.isPending || updateMut.isPending;
  // Com alunos no plano a periodicidade nao muda (o servico recusa): ja trava na tela.
  const studentsInPlan = plan ? (activeClients ?? []).filter((c) => c.planId === plan.id).length : 0;

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
    const inPlan = studentsInPlan;
    if (plan && inPlan > 0 && values.priceCents !== plan.priceCents) {
      const ok = await confirm({
        title: "Mudar o valor do plano?",
        description: `Vale para ${inPlan === 1 ? "o aluno deste plano" : `os ${inPlan} alunos deste plano`} a partir da próxima mensalidade. As já geradas ficam como estão.`,
        confirmLabel: "Mudar o valor",
        variant: "default",
      });
      if (!ok) return;
    }
    const payload: CreatePlan = {
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
      {confirmDialog}
      <form id={formId} onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody className="space-y-4">
          <InputText<PlanFormValues>
            name="name"
            label="Nome"
            placeholder="Digite o nome"
            required
            disabled={pending}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField<PlanFormValues>
              name="period"
              label="Periodicidade"
              options={PERIOD_OPTIONS}
              clearable={false}
              required
              disabled={pending || studentsInPlan > 0}
              hint={studentsInPlan > 0 ? "Plano com alunos: para mudar, crie outro plano." : undefined}
            />
            <InputCurrency<PlanFormValues>
              name="priceCents"
              label="Valor"
              required
              disabled={pending}
            />
          </div>
        </DialogBody>
        <DialogFormFooter
          isPending={pending}
          isEdit={isEdit}
          createLabel="Adicionar"
          editLabel="Salvar"
          onCancel={onCancel}
          className="shrink-0 border-t border-border/40 bg-background p-6 pt-4"
        />
      </form>
    </FormProvider>
  );
}
