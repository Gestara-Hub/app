import { z } from "zod";
import { SERVICE_CATEGORIES } from "@/lib/labels";

/**
 * Schema de formulario do Service (validacao da UI). Mensagens EXATAS do
 * doc 10-estados-e-mensagens.md. Validacao no submit, revalida no change
 * (config do useForm na tela). Independente da validacao do service.
 */
export const serviceFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do serviço."),
  category: z
    .string()
    .refine((v) => (SERVICE_CATEGORIES as string[]).includes(v), {
      message: "Selecione uma categoria.",
    }),
  durationMinutes: z
    .number({ error: "A duração deve ser maior que zero." })
    .int("A duração deve ser maior que zero.")
    .positive("A duração deve ser maior que zero."),
  priceCents: z
    .number({ error: "Informe o preço." })
    .int()
    .min(0, "O preço não pode ser negativo."),
  description: z.string().trim().optional(),
  active: z.boolean(),
});

export type ServiceFormValues = z.infer<typeof serviceFormSchema>;
