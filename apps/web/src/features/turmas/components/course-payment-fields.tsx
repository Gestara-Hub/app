"use client";

import { useState } from "react";
import { FormProvider, useForm, useFormState, useWatch, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import type { ClassGroup, EnrollmentCourseChoice } from "@gestarahub/contracts";
import { getFieldErrors } from "@gestarahub/core/api-error";
import { formatCents } from "@gestarahub/core/format";
import { DateField, InputCurrency, SelectField } from "@/components/form";
import { paymentSummary } from "../installments-summary";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const coursePaymentSchema = z
  .object({
    priceCents: z
      .number({ error: "Informe o valor do curso." })
      .int("Informe o valor do curso.")
      .min(1, "Informe o valor do curso."),
    installments: z.string().min(1, "Escolha as parcelas."),
    firstDueDate: z.string().regex(DATE_RE, "Informe o 1º vencimento."),
  })
  // Parcela de R$ 0 nao e cobranca (mesma regra do servico).
  .refine((v) => v.priceCents >= Number(v.installments), {
    path: ["installments"],
    message: "Cada parcela precisa de pelo menos R$ 0,01.",
  });

export type CoursePaymentValues = z.infer<typeof coursePaymentSchema>;

type CourseClass = Pick<ClassGroup, "coursePriceCents" | "courseMaxInstallments">;

/** Valor cheio do curso, a vista, vencendo hoje (decisao 2: entrar no meio paga o valor cheio). */
export function coursePaymentDefaults(turma: CourseClass): CoursePaymentValues {
  return {
    priceCents: turma.coursePriceCents ?? 0,
    installments: "1",
    firstDueDate: format(new Date(), "yyyy-MM-dd"),
  };
}

export function useCoursePaymentForm(turma: CourseClass): UseFormReturn<CoursePaymentValues> {
  return useForm<CoursePaymentValues>({
    resolver: zodResolver(coursePaymentSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: coursePaymentDefaults(turma),
  });
}

/** Valida o bloco e devolve a escolha para o servico (ou `null` se ha erro na tela). */
export async function readCourseChoice(
  form: UseFormReturn<CoursePaymentValues>,
): Promise<EnrollmentCourseChoice | null> {
  if (!(await form.trigger())) return null;
  const v = form.getValues();
  return { priceCents: v.priceCents, installments: Number(v.installments), firstDueDate: v.firstDueDate };
}

/** Erros do servico em `course.*` voltam para o campo do bloco. Retorna se mapeou algum. */
export function applyCourseErrors(form: UseFormReturn<CoursePaymentValues>, error: unknown): boolean {
  const fields = (getFieldErrors(error) ?? []).filter((f) => f.field.startsWith("course."));
  for (const f of fields) {
    form.setError(f.field.slice("course.".length) as keyof CoursePaymentValues, { message: f.message });
  }
  return fields.length > 0;
}

/** "R$ 150,00 à vista, vence hoje" ou "R$ 600,00 em 3x, 1ª vence 25/10". */
function chargeLine(priceCents: number, installments: number, firstDueDate: string): string {
  const today = format(new Date(), "yyyy-MM-dd");
  const due = !DATE_RE.test(firstDueDate)
    ? null
    : firstDueDate === today
      ? "hoje"
      : format(parseISO(firstDueDate), "dd/MM");
  const price = formatCents(priceCents);
  if (installments <= 1) return due ? `${price} à vista, vence ${due}` : `${price} à vista`;
  return due ? `${price} em ${installments}x, 1ª vence ${due}` : `${price} em ${installments}x`;
}

/**
 * Cobranca do curso na matricula (e na promocao da lista de espera). Fechado,
 * e uma linha com o padrao da turma ("Cobrança de cada aluno: R$ 150,00 à
 * vista, vence hoje · Alterar"); "Alterar" abre valor (cheio por padrao, e o
 * desconto do curso), parcelas de 1 ate o maximo da turma e 1o vencimento, com
 * a conta ao vivo. Erro de validacao ou do servico abre os campos.
 */
export function CoursePaymentFields({
  form,
  turma,
  disabled,
  appliesToMany,
}: {
  form: UseFormReturn<CoursePaymentValues>;
  turma: CourseClass;
  disabled?: boolean;
  /** Varios alunos selecionados: a escolha vale para cada um. */
  appliesToMany?: boolean;
}) {
  const max = turma.courseMaxInstallments ?? 1;
  const options = Array.from({ length: max }, (_, i) => ({
    value: String(i + 1),
    label: i === 0 ? "À vista" : `${i + 1}x`,
  }));
  const [priceCents, installments, firstDueDate] = useWatch({
    control: form.control,
    name: ["priceCents", "installments", "firstDueDate"],
  });
  const summary = paymentSummary(priceCents ?? 0, Number(installments), firstDueDate ?? "");
  const [editing, setEditing] = useState(false);
  const { errors } = useFormState({ control: form.control });
  const open = editing || Object.keys(errors).length > 0;
  const title = appliesToMany ? "Cobrança de cada aluno" : "Cobrança do aluno";

  if (!open) {
    return (
      <section aria-label={title} className="rounded-lg border bg-muted/15 px-3.5 py-3">
        <p className="text-sm text-foreground" data-testid="course-charge-line">
          <span className="font-medium">{title}:</span>{" "}
          {chargeLine(priceCents ?? 0, Number(installments), firstDueDate ?? "")}
          <span className="text-muted-foreground"> · </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setEditing(true)}
            className="cursor-pointer font-medium underline underline-offset-4 hover:text-primary disabled:cursor-default disabled:opacity-50"
          >
            Alterar
          </button>
        </p>
      </section>
    );
  }

  return (
    <FormProvider {...form}>
      <section aria-label={title} className="space-y-3 rounded-lg border bg-muted/15 p-3.5">
        <p className="text-sm font-medium">{title}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <InputCurrency<CoursePaymentValues>
            id="course-price"
            name="priceCents"
            label="Valor"
            required
            disabled={disabled}
          />
          <SelectField<CoursePaymentValues>
            id="course-installments"
            name="installments"
            label="Parcelas"
            options={options}
            clearable={false}
            disabled={disabled || max === 1}
          />
          <DateField<CoursePaymentValues>
            id="course-first-due"
            name="firstDueDate"
            label="1º vencimento"
            required
            disabled={disabled}
          />
        </div>
        {summary ? (
          <p className="text-xs text-muted-foreground" data-testid="course-installments-summary">
            {summary}
            {appliesToMany ? " Vale para cada aluno." : ""}
          </p>
        ) : null}
      </section>
    </FormProvider>
  );
}
