import { z } from "zod";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Schema de formulario do Client (validacao da UI). Mensagens alinhadas ao
 * clientsService. Validacao no submit, revalida no change.
 */
export const clientFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do cliente."),
  phone: z
    .string()
    .trim()
    .min(1, "Informe o telefone.")
    .refine((v) => v.replace(/\D/g, "").length >= 10, {
      message: "Informe um telefone válido.",
    }),
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || EMAIL_RE.test(v), {
      message: "Informe um e-mail válido.",
    }),
  notes: z.string().trim().optional(),
  active: z.boolean(),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;
