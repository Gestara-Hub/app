import { z } from "zod";

/**
 * Schema de formulario do Professional. Mensagens alinhadas ao
 * professionalsService. Validacao no submit, revalida no change.
 */
export const professionalFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do profissional."),
  role: z.string().trim().min(1, "Selecione o cargo."),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || v.replace(/\D/g, "").length >= 10, {
      message: "Informe um telefone válido.",
    }),
  serviceIds: z.array(z.string()).min(1, "Selecione ao menos um serviço."),
  workingHours: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        start: z.string(),
        end: z.string(),
      }),
    )
    .refine((hours) => hours.every((h) => h.start < h.end), {
      message: "Horário inválido: o início deve ser antes do fim.",
    }),
  active: z.boolean(),
});

export type ProfessionalFormValues = z.infer<typeof professionalFormSchema>;
