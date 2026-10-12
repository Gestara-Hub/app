import { format } from "date-fns";
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
  birthDate: z
    .string()
    .optional()
    // Data local (nao UTC), como no resto do app.
    .refine((v) => !v || v <= format(new Date(), "yyyy-MM-dd"), {
      message: "A data de nascimento não pode ser futura.",
    }),
  guardians: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Informe o nome do responsável."),
        relationship: z.string().trim().optional(),
        phone: z
          .string()
          .trim()
          .optional()
          .refine((v) => !v || v.replace(/\D/g, "").length >= 10, {
            message: "Informe um telefone válido.",
          }),
        email: z
          .string()
          .trim()
          .optional()
          .refine((v) => !v || EMAIL_RE.test(v), {
            message: "Informe um e-mail válido.",
          }),
      }),
    )
    .optional(),

  // Endereço estruturado (opcional)
  address: addressSchema.optional(),

  // Plano e Mensalidade (vínculo no aluno)
  planId: z.string().optional(),
  planStartDate: z.string().optional(),
  billingStrategy: z.enum(["prorated", "full_cycle"], { error: "Selecione como cobrar a entrada." }).optional(),
  cyclePaymentTiming: z.enum(["prepaid", "postpaid"], { error: "Selecione o momento do pagamento." }).optional(),
  firstChargeAmount: z
    .number({ error: "O valor da 1ª mensalidade não pode ser negativo." })
    .min(0, "O valor da 1ª mensalidade não pode ser negativo.")
    .nullish(),
  firstChargeDueDate: z.string().optional(),
  dueDay: z
    .number({ error: "Dia deve ser entre 1 e 31." })
    .int("Dia deve ser um número inteiro.")
    .min(1, "Dia deve ser entre 1 e 31.")
    .max(31, "Dia deve ser entre 1 e 31.")
    .nullish(),
  membershipStatus: z.enum(["active", "paused", "canceled"], { error: "Selecione a situação da assinatura." }).optional(),
  hasDiscount: z.boolean().optional(),
  discountType: z.enum(["percentage", "fixed"], { error: "Selecione o tipo de desconto." }).optional(),
  discountValue: z
    .number({ error: "O desconto não pode ser negativo." })
    .min(0, "O desconto não pode ser negativo.")
    .nullish(),
  discountReason: z.string().trim().optional(),
  /** Como o aluno paga: mensalidade (plano), bolsa ou sem mensalidade. */
  paymentMode: z.enum(["membership", "scholarship", "none"]).optional(),
  scholarshipKind: z.enum(["full", "partial"]).optional(),
  /** Bolsa parcial definida por % ou pelo valor que o aluno paga. */
  scholarshipBy: z.enum(["percent", "amount"]).optional(),
  scholarshipPayCents: z.number({ error: "Informe o valor a pagar." }).nullish(),
  scholarshipPercent: z
    .number({ error: "Informe a porcentagem da bolsa." })
    .nullish(),
  discountValidUntil: z.string().optional(),
}).refine(
  (data) => {
    if (data.hasDiscount && data.paymentMode !== "scholarship" && data.discountType === "percentage") {
      return (data.discountValue ?? 0) <= 100;
    }
    return true;
  },
  {
    message: "O desconto percentual não pode ser superior a 100%.",
    path: ["discountValue"],
  },
).refine(
  (data) => {
    if (isPartialScholarship(data) && data.scholarshipBy !== "amount") {
      const pct = data.scholarshipPercent ?? 0;
      return pct >= 1 && pct <= 99;
    }
    return true;
  },
  {
    message: "Use de 1% a 99%. Para 100%, escolha bolsa integral.",
    path: ["scholarshipPercent"],
  },
).refine(
  (data) => !isPartialScholarship(data) || data.scholarshipBy !== "amount" || (data.scholarshipPayCents ?? 0) > 0,
  { message: "Informe o valor que o aluno paga.", path: ["scholarshipPayCents"] },
).refine(
  (data) => {
    if (data.paymentMode === "membership") return Boolean(data.planId);
    if (isPartialScholarship(data)) return Boolean(data.planId);
    return true;
  },
  { message: "Selecione o plano.", path: ["planId"] },
);

function isPartialScholarship(data: { paymentMode?: string; scholarshipKind?: string }): boolean {
  return data.paymentMode === "scholarship" && data.scholarshipKind === "partial";
}

export type ClientFormValues = z.infer<typeof clientFormSchema>;

