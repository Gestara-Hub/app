import { z } from "zod";
import type { Unit, Weekday } from "@gestarahub/contracts";
import { checkSlotWithinBusinessHours } from "@gestarahub/core/scheduling";

/**
 * Schema do formulario de Turma (Modelo 3). Mensagens alinhadas ao turmasService.
 * `meetingSlots` = encontros recorrentes (dia + horario) que geram as sessoes.
 */
export const turmaFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da turma."),
  // Modalidade (= Category) obrigatória.
  modalityId: z.string().min(1, "Selecione a modalidade da turma."),
  // Plano de mensalidade legado/opcional (agora gerenciado no Aluno).
  planId: z.string().optional(),
  instructorId: z.string().min(1, "Selecione o instrutor."),
  allowDropin: z.boolean(),
  sessionPriceCents: z.number().int().min(0).nullish(),
  capacity: z
    .number({ error: "Informe a capacidade da turma (ao menos 1 vaga)." })
    .int("A capacidade deve ser um número inteiro.")
    .min(1, "A capacidade deve ser ao menos 1."),
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
    .refine((slots) => slots.every((s) => s.start && s.end && s.start < s.end), {
      message: "Horário inválido: informe início e fim (o início deve ser antes do fim).",
    }),
});

export type TurmaFormValues = z.infer<typeof turmaFormSchema>;

/**
 * Cria o schema de validação para turmas considerando os horários de
 * funcionamento da unidade (businessHours).
 */
export function getTurmaFormSchema(unit?: Unit) {
  return turmaFormSchema.superRefine((data, ctx) => {
    if (!unit?.businessHours || unit.businessHours.length === 0) return;
    for (const slot of data.meetingSlots) {
      if (!slot.start || !slot.end || slot.start >= slot.end) continue;
      const check = checkSlotWithinBusinessHours(
        slot.weekday as Weekday,
        slot.start,
        slot.end,
        unit.businessHours,
      );
      if (!check.valid && check.message) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["meetingSlots"],
          message: check.message,
        });
        return;
      }
    }
  });
}

