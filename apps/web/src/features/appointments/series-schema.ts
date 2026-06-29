import { z } from "zod";

export const seriesFormSchema = z
  .object({
    clientId: z.string().min(1, "Selecione um cliente."),
    professionalId: z.string().min(1, "Selecione um profissional."),
    serviceId: z.string().min(1, "Selecione um serviço."),
    frequency: z.enum(["weekly", "biweekly", "monthly"]),
    startDate: z.string().min(1, "Selecione a data de início."),
    time: z.string().min(1, "Selecione o horário."),
    endMode: z.enum(["count", "date"]),
    untilOccurrences: z.number().int().min(1).optional(),
    untilDate: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.endMode === "count") {
      if (!v.untilOccurrences || v.untilOccurrences < 1) {
        ctx.addIssue({
          path: ["untilOccurrences"],
          code: "custom",
          message: "Informe o número de ocorrências.",
        });
      }
    } else if (!v.untilDate) {
      ctx.addIssue({
        path: ["untilDate"],
        code: "custom",
        message: "Selecione a data final.",
      });
    }
  });

export type SeriesFormValues = z.infer<typeof seriesFormSchema>;
