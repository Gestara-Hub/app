"use client";

import { useMemo, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import type { ChargeView, Client } from "@gestarahub/contracts";
import { MAX_INSTALLMENTS } from "@gestarahub/core/billing";
import { getFieldErrors } from "@gestarahub/core/api-error";
import {
  ComboboxField,
  DateField,
  DialogFormFooter,
  InputCurrency,
  InputText,
  SelectField,
} from "@/components/form";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { handleFormApiError } from "@/lib/form-errors";
import { cn } from "@/lib/utils";
import { useClients } from "@/features/clients";
import { useBusinessSegment } from "@/features/settings";
import { useCreateExtraCharge } from "../hooks/use-billing";
import { installmentsSummary } from "../installments-summary";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DESCRIPTION_MAX = 80;

const schema = z.object({
  studentId: z.string({ error: "Selecione o aluno." }).min(1, "Selecione o aluno."),
  description: z
    .string()
    .trim()
    .min(1, "Descreva a cobrança.")
    .max(DESCRIPTION_MAX, `Use no máximo ${DESCRIPTION_MAX} caracteres.`),
  totalCents: z
    .number({ error: "Informe o valor." })
    .int("Informe o valor.")
    .min(1, "Informe o valor."),
  firstDueDate: z.string().regex(DATE_RE, "Informe o vencimento."),
  installments: z.string().min(1, "Escolha as parcelas."),
});
type ExtraChargeValues = z.infer<typeof schema>;

const INSTALLMENT_OPTIONS = Array.from({ length: MAX_INSTALLMENTS }, (_, i) => ({
  value: String(i + 1),
  label: i === 0 ? "À vista" : `${i + 1}x`,
}));

function ExtraChargeForm({
  student,
  onSuccess,
}: {
  student?: Pick<Client, "id" | "name">;
  onSuccess: (created: ChargeView[]) => void;
}) {
  const createMut = useCreateExtraCharge();
  const pending = createMut.isPending;
  const segment = useBusinessSegment();
  const { data: clients, isPending: clientsPending } = useClients({ status: "active" });

  const studentOptions = useMemo(
    () => (student ? [] : (clients ?? []).map((c) => ({ value: c.id, label: c.name }))),
    [clients, student],
  );

  const suggestions = [
    "Taxa de matrícula",
    "Material",
    "Uniforme",
    segment.id === "martial_arts" ? "Exame de faixa" : "Exame de graduação",
    "Evento",
  ];

  const form = useForm<ExtraChargeValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      studentId: student?.id ?? "",
      description: "",
      totalCents: 0,
      firstDueDate: format(new Date(), "yyyy-MM-dd"),
      installments: "1",
    },
  });

  const [description, totalCents, firstDueDate, installments] = useWatch({
    control: form.control,
    name: ["description", "totalCents", "firstDueDate", "installments"],
  });
  const summary = installmentsSummary(totalCents, Number(installments), firstDueDate);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const created = await createMut.mutateAsync({
        studentId: values.studentId,
        description: values.description.trim(),
        totalCents: values.totalCents,
        firstDueDate: values.firstDueDate,
        installments: Number(values.installments),
      });
      toast.success(created.length > 1 ? `${created.length} parcelas lançadas.` : "Cobrança lançada.");
      onSuccess(created);
    } catch (error) {
      // Aluno fixo (aberto pela ficha): o campo nao aparece, o erro vira aviso.
      const studentError = student
        ? getFieldErrors(error)?.find((f) => f.field === "studentId")
        : undefined;
      if (studentError) toast.error(studentError.message);
      else handleFormApiError(error, form, "Não foi possível lançar a cobrança.");
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody className="space-y-4">
          {student ? null : (
            <ComboboxField<ExtraChargeValues>
              name="studentId"
              label="Aluno"
              placeholder={clientsPending ? "Carregando..." : "Selecione o aluno"}
              searchPlaceholder="Buscar aluno..."
              emptyMessage="Nenhum aluno ativo encontrado."
              options={studentOptions}
              required
              disabled={pending}
            />
          )}

          <div className="space-y-2">
            <InputText<ExtraChargeValues>
              name="description"
              label="Descrição"
              placeholder="Descreva a cobrança"
              required
              disabled={pending}
            />
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-0.5 text-[11px] text-muted-foreground">Sugestões:</span>
              {suggestions.map((suggestion) => {
                const selected = description.trim().toLowerCase() === suggestion.toLowerCase();
                return (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      form.setValue("description", suggestion, { shouldValidate: true, shouldDirty: true })
                    }
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                      selected
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border/70 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    + {suggestion}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputCurrency<ExtraChargeValues> name="totalCents" label="Valor" required disabled={pending} />
            <DateField<ExtraChargeValues> name="firstDueDate" label="Vencimento" required disabled={pending} />
          </div>

          <div className="space-y-2">
            <SelectField<ExtraChargeValues>
              name="installments"
              label="Parcelas"
              options={INSTALLMENT_OPTIONS}
              clearable={false}
              disabled={pending}
            />
            {summary ? (
              <p className="text-xs text-muted-foreground" data-testid="installments-summary">
                {summary}
              </p>
            ) : null}
          </div>
        </DialogBody>
        <DialogFormFooter isPending={pending} className="shrink-0 border-t border-border/40 px-6 py-4" />
      </form>
    </FormProvider>
  );
}

/**
 * Nova cobranca avulsa (taxa, material, uniforme, exame, evento), a vista ou
 * parcelada. Em Mensalidades escolhe o aluno; na lista de alunos ja vem fixo.
 */
export function NewExtraChargeDialog({
  open,
  onOpenChange,
  student,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Aluno fixo (aberto pela lista de alunos). */
  student?: Pick<Client, "id" | "name"> | null;
  onCreated?: (created: ChargeView[]) => void;
}) {
  // Retem o aluno durante a animacao de saida; `session` recomeca o formulario a cada abertura.
  const [shown, setShown] = useState({ open, student, session: 0 });
  if (open && (!shown.open || student !== shown.student)) {
    setShown({ open, student, session: shown.open ? shown.session : shown.session + 1 });
  } else if (!open && shown.open) {
    setShown({ ...shown, open: false });
  }
  const fixed = shown.student ?? undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-14">
          <DialogTitle>Nova cobrança</DialogTitle>
          <DialogDescription>
            {fixed
              ? `Cobrança avulsa para ${fixed.name}, à vista ou parcelada.`
              : "Taxa, material, uniforme ou evento, à vista ou parcelado."}
          </DialogDescription>
        </DialogHeader>
        <ExtraChargeForm
          key={`${shown.session}-${fixed?.id ?? "any"}`}
          student={fixed}
          onSuccess={(created) => {
            onCreated?.(created);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
