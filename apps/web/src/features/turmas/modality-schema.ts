import { z } from "zod";
import { normalizePassingGrade, validateMinAttendance } from "@gestarahub/core/grades";
import { validateMeasures } from "@gestarahub/core/measurements";

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
    /** Cor no Calendario (doc product/29, versao 2). Vazio = a sugerida (a atual ou a primeira livre). */
    color: z.string(),
    active: z.boolean(),
    assessmentsEnabled: z.boolean(),
    assessmentScale: z.enum(["zero_ten", "zero_hundred", "concept", "pass_fail"]),
    passingGrade: z.string(),
    resultMode: z.enum(["average", "sum"]),
    minAttendance: z.string(),
    // Testes e medidas (doc 21 §2.4, fase B).
    measurementsEnabled: z.boolean(),
    measures: z.array(
      z.object({
        key: z.string(),
        id: z.string(),
        name: z.string(),
        unit: z.string(),
        better: z.enum(["higher", "lower"]),
      }),
    ),
  })
  .superRefine((values, ctx) => {
    if (values.measurementsEnabled) {
      const check = validateMeasures(values.measures);
      if (!check.ok) ctx.addIssue({ code: "custom", path: ["measures"], message: check.message });
      else if (check.value.length === 0) {
        ctx.addIssue({ code: "custom", path: ["measures"], message: "Adicione pelo menos uma medida." });
      }
    }
    if (!values.assessmentsEnabled) return;
    const check = normalizePassingGrade(values.assessmentScale, values.passingGrade);
    if (!check.ok) ctx.addIssue({ code: "custom", path: ["passingGrade"], message: check.message });
    if (values.minAttendance.trim()) {
      const attendance = validateMinAttendance(values.minAttendance);
      if (!attendance.ok) ctx.addIssue({ code: "custom", path: ["minAttendance"], message: attendance.message });
    }
  });

export type ModalityFormValues = z.infer<typeof modalityFormSchema>;
