import { z } from "zod";

/**
 * Schema do formulario de Turma (Modelo 3). Mensagens alinhadas ao turmasService.
 * `meetingSlots` = encontros recorrentes (dia + horario) que geram as sessoes.
 */
export const turmaFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da turma."),
  // Modalidade (= Category) obrigatória.
  modalityId: z.string().min(1, "Selecione a modalidade da turma."),
  // Plano de mensalidade opcional; vazio = turma sem cobranca.
  planId: z.string(),
  instructorId: z.string().min(1, "Selecione o instrutor."),
  allowDropin: z.boolean(),
  sessionPriceCents: z.number().int().min(0).optional(),
  capacity: z.number().int().min(1, "A capacidade deve ser ao menos 1."),
  startDate: z.string().min(1, "Informe a data de início."),
  meetingSlots: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        start: z.string(),
        end: z.string(),
      }),
    )
    .min(1, "Marque ao menos um dia de encontro.")
    .refine((slots) => slots.every((s) => s.start < s.end), {
      message: "Horário inválido: o início deve ser antes do fim.",
    }),
});

export type TurmaFormValues = z.infer<typeof turmaFormSchema>;
