import { z } from "zod";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Checagem por `.includes` (nao por `v === ...`) de proposito: evita o type
// predicate inferido pelo TS, mantendo o output do campo como `string` — assim
// o formulario aceita "" como default (perfil sem selecao) e o `.min(1)` forca a
// escolha explicita no submit.
const USER_PROFILES: readonly string[] = [
  "owner",
  "manager",
  "attendant",
  "professional",
];

/**
 * Schema de formulario do Usuario (validacao da UI). Mensagens alinhadas ao
 * usersService. `professionalId` vazio = usuario sem vinculo com profissional
 * (obrigatorio no perfil Profissional).
 */
export const userFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  email: z
    .string()
    .trim()
    .min(1, "Informe o e-mail.")
    .refine((v) => EMAIL_RE.test(v), { message: "Informe um e-mail válido." }),
  // Sem default no formulario: vazio forca a selecao explicita do perfil.
  profile: z
    .string()
    .min(1, "Selecione o perfil de acesso.")
    .refine((v) => USER_PROFILES.includes(v), {
      message: "Selecione o perfil de acesso.",
    }),
  professionalId: z.string().optional(),
  active: z.boolean(),
}).superRefine((values, ctx) => {
  // Perfil Profissional sem vinculo nao enxerga agenda nenhuma: exige o vinculo.
  if (values.profile === "professional" && !values.professionalId) {
    ctx.addIssue({
      code: "custom",
      path: ["professionalId"],
      message: "Vincule o usuário a um profissional da equipe.",
    });
  }
});

export type UserFormValues = z.infer<typeof userFormSchema>;
