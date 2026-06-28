import { z } from "zod";
import { CATEGORIAS_SERVICO } from "@/types";

/**
 * Schema de formulario do Servico (validacao da UI). Mensagens EXATAS do
 * doc 10-estados-e-mensagens.md. Validacao no submit, revalida no change
 * (config do useForm na tela). Independente da validacao do service.
 */
export const serviceFormSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do serviço."),
  categoria: z
    .string()
    .refine((v) => (CATEGORIAS_SERVICO as string[]).includes(v), {
      message: "Selecione uma categoria.",
    }),
  duracaoMinutos: z
    .number({ error: "A duração deve ser maior que zero." })
    .int("A duração deve ser maior que zero.")
    .positive("A duração deve ser maior que zero."),
  precoCentavos: z
    .number({ error: "Informe o preço." })
    .int()
    .min(0, "O preço não pode ser negativo."),
  descricao: z.string().trim().optional(),
  ativo: z.boolean(),
});

export type ServiceFormValues = z.infer<typeof serviceFormSchema>;
