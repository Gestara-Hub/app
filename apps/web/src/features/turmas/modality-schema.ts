import { z } from "zod";

/**
 * Schema de formulário da Modalidade (Category no M3). Mensagens alinhadas ao
 * categoriesService. Validação no submit, revalida no change.
 */
export const modalityFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da modalidade."),
  active: z.boolean(),
});

export type ModalityFormValues = z.infer<typeof modalityFormSchema>;
