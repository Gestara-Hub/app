import { z } from "zod";

/**
 * Schema de formulario do Professional. Mensagens alinhadas ao
 * professionalsService. Validacao no submit, revalida no change.
 */
export const professionalFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do profissional."),
  // Cargo opcional: campo pode ficar vazio.
  role: z.string().trim(),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || v.replace(/\D/g, "").length >= 10, {
      message: "Informe um telefone válido.",
    }),
  // Serviços (M1) / modalidades (M3) opcionais: podem ficar vazios (a
  // associação é informativa). O form mostra um OU outro conforme o modelo.
  serviceIds: z.array(z.string()),
  modalityIds: z.array(z.string()),
  workingHours: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        start: z.string(),
        end: z.string(),
        breakStart: z.string().optional(),
        breakEnd: z.string().optional(),
      }),
    )
    .refine((hours) => hours.every((h) => h.start < h.end), {
      message: "Horário inválido: o início deve ser antes do fim.",
    })
    .refine(
      (hours) =>
        hours.every((h) => {
          if (!h.breakStart && !h.breakEnd) return true;
          return (
            Boolean(h.breakStart) &&
            Boolean(h.breakEnd) &&
            h.start <= h.breakStart! &&
            h.breakStart! < h.breakEnd! &&
            h.breakEnd! <= h.end
          );
        }),
      { message: "Almoço inválido: deve ficar dentro do expediente do dia." },
    ),
  active: z.boolean(),
});

export type ProfessionalFormValues = z.infer<typeof professionalFormSchema>;
