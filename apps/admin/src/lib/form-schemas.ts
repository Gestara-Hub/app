import { z } from "zod";

/**
 * Schemas dos formularios do painel, usados no navegador (React Hook Form). As
 * server actions validam de novo com as proprias regras (a autoridade e o
 * servidor); aqui ficam as mesmas mensagens para o erro aparecer por campo,
 * antes de enviar.
 */
export const REASON_MIN = 5;
export const reasonField = z
  .string()
  .trim()
  .min(REASON_MIN, "Diga o motivo (pelo menos 5 letras).")
  .max(300, "Motivo de até 300 caracteres.");

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Informe seu e-mail.").email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
  next: z.string().optional(),
});

export const acceptSchema = z
  .object({
    token: z.string().min(10),
    password: z.string().min(12, "A senha precisa ter 12 ou mais caracteres.").max(200, "Use no máximo 200 caracteres."),
    confirm: z.string().min(1, "Repita a senha."),
  })
  .refine((v) => v.password === v.confirm, { message: "As senhas não conferem.", path: ["confirm"] });

export const mfaSchema = z.object({
  factorId: z.string(),
  next: z.string().optional(),
  code: z
    .string()
    .transform((v) => v.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, "Digite os 6 números do aplicativo.")),
});

export const inviteSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(80, "Use no máximo 80 caracteres."),
  email: z.string().trim().min(1, "Informe o e-mail.").email("Informe um e-mail válido."),
  role: z.enum(["platform_owner", "platform_support", "platform_finance", "platform_viewer"]),
});

export const threadNoteSchema = z.object({ threadId: z.string(), body: z.string().trim().min(1, "Escreva a nota.").max(4000, "Use no máximo 4000 caracteres.") });
export const spaceNoteSchema = z.object({ spaceId: z.string(), body: z.string().trim().min(1, "Escreva a anotação.").max(2000, "Use no máximo 2000 caracteres.") });
export const replySchema = z.object({ threadId: z.string(), body: z.string().trim().min(1, "Escreva a mensagem.").max(4000, "Use no máximo 4000 caracteres.") });
export const macroSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Informe o título.").max(80, "Use no máximo 80 caracteres."),
  body: z.string().trim().min(1, "Escreva o texto da resposta.").max(4000, "Use no máximo 4000 caracteres."),
});

export const userTwoFactorSchema = z.object({ spaceId: z.string(), userId: z.string().min(1, "Escolha a pessoa."), reason: reasonField });
export const accessSchema = z.object({ spaceId: z.string(), reason: reasonField });
export const reasonOnlySchema = z.object({ spaceId: z.string(), reason: reasonField });
export const courtesySchema = z.object({
  spaceId: z.string(),
  tier: z.enum(["pro", "scale"]),
  days: z.coerce.number({ error: "Informe os dias." }).int("Informe os dias.").min(1, "De 1 a 365 dias.").max(365, "De 1 a 365 dias."),
  reason: reasonField,
});
export const graceSchema = z.object({
  spaceId: z.string(),
  days: z.coerce.number({ error: "Informe os dias." }).int("Informe os dias.").min(1, "De 1 a 30 dias.").max(30, "De 1 a 30 dias."),
  reason: reasonField,
});
export const forceFreeSchema = (needsPartnerCheck: boolean) =>
  z.object({
    spaceId: z.string(),
    partnerCanceled: z.boolean().refine((v) => !needsPartnerCheck || v, "Confirme que cancelou a assinatura no parceiro."),
    reason: reasonField,
  });

export const privacyRequestSchema = z.object({
  requesterName: z.string().trim().min(2, "Informe o nome de quem pediu.").max(120, "Use no máximo 120 caracteres."),
  requesterEmail: z.string().trim().min(1, "Informe o e-mail.").email("Informe um e-mail válido."),
  kind: z.enum(["access", "correction", "deletion", "portability", "revoke_consent", "other"]),
  description: z.string().trim().min(3, "Descreva o pedido.").max(2000, "Use no máximo 2000 caracteres."),
  spaceId: z.string().trim().optional(),
});
export const privacyUpdateSchema = z
  .object({
    id: z.string(),
    status: z.enum(["open", "in_progress", "done", "rejected"]),
    resolution: z.string().trim().max(2000, "Use no máximo 2000 caracteres."),
  })
  .refine((v) => !["done", "rejected"].includes(v.status) || v.resolution.length >= 5, {
    message: "Descreva o que foi feito para concluir ou recusar.",
    path: ["resolution"],
  });

const uuid = z.string().uuid();
export const announcementSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(3, "O título precisa de ao menos 3 letras.").max(120, "Use no máximo 120 caracteres no título."),
    body: z.string().trim().min(3, "Escreva a mensagem.").max(1000, "Use no máximo 1000 caracteres na mensagem."),
    severity: z.enum(["info", "warning", "urgent"]),
    audience: z.enum(["all", "tier", "area", "spaces"]),
    tiers: z.array(z.string()),
    areas: z.array(z.string()),
    spaces: z.string(),
    startsAt: z.string(),
    endsAt: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.audience === "tier" && v.tiers.length === 0) ctx.addIssue({ code: "custom", path: ["tiers"], message: "Escolha ao menos um plano." });
    if (v.audience === "area" && v.areas.length === 0) ctx.addIssue({ code: "custom", path: ["areas"], message: "Escolha ao menos uma área." });
    if (v.audience === "spaces") {
      const ids = v.spaces.split(/[\s,;]+/).filter(Boolean);
      if (ids.length === 0) ctx.addIssue({ code: "custom", path: ["spaces"], message: "Informe ao menos um espaço." });
      else if (ids.some((s) => !uuid.safeParse(s).success)) ctx.addIssue({ code: "custom", path: ["spaces"], message: "Informe os espaços pelo código (um por linha)." });
    }
    if (v.startsAt && v.endsAt && new Date(v.endsAt) <= new Date(v.startsAt)) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "O fim precisa ser depois do início." });
  });
