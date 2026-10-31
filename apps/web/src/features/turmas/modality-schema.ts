import { z } from "zod";
import { normalizePassingGrade, validateMinAttendance } from "@gestarahub/core/grades";

/**
 * Schema de formulário da Modalidade (Category no M3). Mensagens alinhadas ao
 * categoriesService. Validação no submit, revalida no change. Avaliações
 * (doc 21 §2.1): a nota mínima é texto e é validada na escala escolhida. Fase
 * A (31/10/2026): como fecha o resultado (média ou soma) e frequência mínima
 * opcional (vazio = sem exigência).
 */
export const modalityFormSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome da modalidade."),
    active: z.boolean(),
    assessmentsEnabled: z.boolean(),
    assessmentScale: z.enum(["zero_ten", "zero_hundred", "concept", "pass_fail"]),
    passingGrade: z.string(),
    resultMode: z.enum(["average", "sum"]),
    minAttendance: z.string(),
  })
  .superRefine((values, ctx) => {
    if (!values.assessmentsEnabled) return;
    const check = normalizePassingGrade(values.assessmentScale, values.passingGrade);
    if (!check.ok) ctx.addIssue({ code: "custom", path: ["passingGrade"], message: check.message });
    if (values.minAttendance.trim()) {
      const attendance = validateMinAttendance(values.minAttendance);
      if (!attendance.ok) ctx.addIssue({ code: "custom", path: ["minAttendance"], message: attendance.message });
    }
  });

export type ModalityFormValues = z.infer<typeof modalityFormSchema>;
