import { z } from "zod";

/**
 * Schema do formulario de evento (doc product/29). Mensagens alinhadas ao
 * eventsService. Dias soltos (data, inicio e fim), quem conduz (equipe ou
 * convidado) e a forma de cobranca com o lote opcional.
 */
export const eventFormSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome do evento."),
    modalityId: z.string().optional(),
    conductor: z.enum(["team", "guest"]),
    instructorId: z.string().optional(),
    guestInstructorName: z.string().trim().optional(),
    guestInstructorOrigin: z.string().trim().optional(),
    capacity: z.number().int("As vagas precisam ser um número inteiro.").min(1, "Informe ao menos 1 vaga.").nullish(),
    billingMode: z.enum(["fixed", "per_day", "free"]),
    priceCents: z.number().int().min(0).nullish(),
    maxInstallments: z.string(),
    hasEarlyBird: z.boolean(),
    earlyBirdPriceCents: z.number().int().min(0).nullish(),
    earlyBirdUntil: z.string().optional(),
    dayPriceCents: z.number().int().min(0).nullish(),
    countsForProgression: z.boolean(),
    description: z.string().trim().optional(),
    sessions: z
      .array(
        z.object({
          id: z.string().optional(),
          date: z.string().min(1, "Informe a data."),
          start: z.string().min(1, "Informe o início."),
          end: z.string().min(1, "Informe o fim."),
          locked: z.boolean().optional(),
        }),
      )
      .min(1, "Informe ao menos um dia do evento.")
      .superRefine((sessions, ctx) => {
        sessions.forEach((s, i) => {
          if (s.start && s.end && s.end <= s.start) {
            ctx.addIssue({ code: "custom", path: [i, "end"], message: "O fim precisa ser depois do início." });
          }
        });
      }),
  })
  .refine((data) => data.conductor !== "team" || Boolean(data.instructorId), {
    path: ["instructorId"],
    message: "Escolha quem conduz o evento.",
  })
  .refine((data) => data.conductor !== "guest" || Boolean(data.guestInstructorName), {
    path: ["guestInstructorName"],
    message: "Informe o nome do convidado.",
  })
  .refine((data) => data.billingMode !== "fixed" || (data.priceCents ?? 0) > 0, {
    path: ["priceCents"],
    message: "Informe o valor do evento.",
  })
  .refine((data) => data.billingMode !== "fixed" || !data.hasEarlyBird || (data.earlyBirdPriceCents ?? 0) > 0, {
    path: ["earlyBirdPriceCents"],
    message: "Informe o valor do lote.",
  })
  .refine(
    (data) => data.billingMode !== "fixed" || !data.hasEarlyBird || (data.earlyBirdPriceCents ?? 0) < (data.priceCents ?? 0),
    { path: ["earlyBirdPriceCents"], message: "O lote precisa ser menor que o valor cheio." },
  )
  .refine((data) => data.billingMode !== "fixed" || !data.hasEarlyBird || Boolean(data.earlyBirdUntil), {
    path: ["earlyBirdUntil"],
    message: "Informe até quando o lote vale.",
  })
  .refine((data) => data.billingMode !== "per_day" || (data.dayPriceCents ?? 0) > 0, {
    path: ["dayPriceCents"],
    message: "Informe o valor do dia.",
  });

export type EventFormValues = z.infer<typeof eventFormSchema>;

/** Inscricao: aluno, dias (por dia) e pagamento. */
export const registerFormSchema = z
  .object({
    studentId: z.string().min(1, "Escolha o aluno."),
    scope: z.enum(["full", "days"]),
    sessionIds: z.array(z.string()),
    amountCents: z.number().int().min(0, "Informe um valor válido.").nullish(),
    installments: z.string(),
    firstDueDate: z.string().optional(),
  })
  .refine((data) => data.scope !== "days" || data.sessionIds.length > 0, {
    path: ["sessionIds"],
    message: "Escolha ao menos um dia.",
  });

export type RegisterFormValues = z.infer<typeof registerFormSchema>;
