import { z } from "zod";

export const blockFormSchema = z
  .object({
    professionalId: z.string().min(1, "Selecione um profissional."),
    date: z.string().min(1, "Selecione a data."),
    start: z.string().min(1, "Selecione o início."),
    end: z.string().min(1, "Selecione o fim."),
    reason: z.string().optional(),
  })
  .refine((v) => !v.start || !v.end || v.start < v.end, {
    message: "O horário de início deve ser anterior ao de fim.",
    path: ["end"],
  });

export type BlockFormValues = z.infer<typeof blockFormSchema>;
