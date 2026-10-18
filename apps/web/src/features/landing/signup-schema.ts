import { z } from "zod";

// Mesma regra de e-mail do cadastro de usuarios (features/users/user-schema).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Cadastro rapido da landing: so nome e e-mail. */
export const signupSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome.").max(80, "Use até 80 caracteres."),
  email: z
    .string()
    .trim()
    .min(1, "Informe seu e-mail.")
    .refine((v) => EMAIL_RE.test(v), { message: "Informe um e-mail válido." }),
});

export type SignupValues = z.infer<typeof signupSchema>;
