import { z } from "zod";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Schema de formulario do Usuario (validacao da UI). Mensagens alinhadas ao
 * usersService. `professionalId` vazio = usuario sem vinculo com profissional.
 */
export const userFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  email: z
    .string()
    .trim()
    .min(1, "Informe o e-mail.")
    .refine((v) => EMAIL_RE.test(v), { message: "Informe um e-mail válido." }),
  profile: z.enum(["owner", "manager", "attendant", "professional"]),
  professionalId: z.string().optional(),
  active: z.boolean(),
});

export type UserFormValues = z.infer<typeof userFormSchema>;
