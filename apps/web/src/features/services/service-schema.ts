import { z } from "zod";

/**
 * Schema de formulario do Service (validacao da UI). Mensagens EXATAS do
 * doc 10-estados-e-mensagens.md. Validacao no submit, revalida no change.
 * `categoryId` referencia a entidade Category (carregada via useCategories).
 */
export const serviceFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do serviço."),
  categoryId: z.string().min(1, "Selecione uma categoria."),
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
