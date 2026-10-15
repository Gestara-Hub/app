import { z } from "zod";
import { normalizePassingGrade } from "@gestarahub/core/grades";

/**
 * Schema de formulário da Modalidade (Category no M3). Mensagens alinhadas ao
 * categoriesService. Validação no submit, revalida no change. Avaliações
 * (doc 21 §2.1): a nota mínima é texto e é validada na escala escolhida.
 */
export const modalityFormSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome da modalidade."),
    active: z.boolean(),
    assessmentsEnabled: z.boolean(),
    assessmentScale: z.enum(["zero_ten", "zero_hundred", "concept", "pass_fail"]),
    passingGrade: z.string(),
  })
  .superRefine((values, ctx) => {
    if (!values.assessmentsEnabled) return;
    const check = normalizePassingGrade(values.assessmentScale, values.passingGrade);
    if (!check.ok) ctx.addIssue({ code: "custom", path: ["passingGrade"], message: check.message });
  });

export type ModalityFormValues = z.infer<typeof modalityFormSchema>;
