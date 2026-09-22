import { z } from "zod";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const addressSchema = z.object({
  postalCode: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

/**
 * Schema de formulario do Client / Aluno (validacao da UI).
 */
export const clientFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
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

  // Endereço estruturado (opcional)
  address: addressSchema.optional(),

  // Plano e Mensalidade (vínculo no aluno)
  planId: z.string().optional(),
  dueDay: z
    .number({ error: "Dia deve ser entre 1 e 31." })
    .int("Dia deve ser um número inteiro.")
    .min(1, "Dia deve ser entre 1 e 31.")
    .max(31, "Dia deve ser entre 1 e 31.")
    .nullish(),
  membershipStatus: z.enum(["active", "paused", "canceled"]).optional(),
  hasDiscount: z.boolean().optional(),
  discountType: z.enum(["percentage", "fixed"]).optional(),
  discountValue: z
    .number({ error: "O desconto não pode ser negativo." })
    .min(0, "O desconto não pode ser negativo.")
    .nullish(),
  discountReason: z.string().trim().optional(),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

