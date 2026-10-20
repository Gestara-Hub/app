import { isPossiblePhone } from "@gestarahub/core/phone";
import { format } from "date-fns";
import { z } from "zod";
import type { ClassBillingMode } from "@gestarahub/contracts";

/** Observacoes do aluno: limite para nao virar um livro. */
export const NOTES_MAX = 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    .refine((v) => isPossiblePhone(v), {
      message: "Informe um telefone válido.",
    }),
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || EMAIL_RE.test(v), {
      message: "Informe um e-mail válido.",
    }),
  notes: z.string().trim().max(NOTES_MAX, `Use no máximo ${NOTES_MAX} caracteres.`).optional(),
  birthDate: z
    .string()
    .optional()
    // Data local (nao UTC), como no resto do app.
    .refine((v) => !v || v <= format(new Date(), "yyyy-MM-dd"), {
      message: "A data de nascimento não pode ser futura.",
    })
    // 1900 virava "126 anos" (ALU-32): mais de 110 anos e ano errado.
    .refine((v) => !v || Number(v.slice(0, 4)) >= new Date().getFullYear() - 110, {
      message: "Confira o ano de nascimento.",
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
          .refine((v) => !v || isPossiblePhone(v), {
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
  /** Como o aluno paga: mensalidade (plano), pacote de aulas, bolsa ou sem mensalidade. */
  paymentMode: z.enum(["membership", "package", "scholarship", "none"]).optional(),
  /**
   * Cadastro que ja vende o pacote escolhido (aluno novo, com permissao de
   * cobrar). Na edicao, o pacote se vende pela acao "Vender pacote".
   */
  sellsPackage: z.boolean().optional(),
  packageId: z.string().optional(),
  /** Consentimento LGPD para menor de 18 anos */
  minorConsentStatus: z
    .enum(["not_applicable", "pending", "confirmed_whatsapp", "confirmed_paper"])
    .optional(),
  minorConsentAt: z.string().optional(),
  minorConsentBy: z.string().optional(),
  hasPaperConsent: z.boolean().optional(),
  packagePriceCents: z.number({ error: "Informe o valor." }).nullish(),
  packageInstallments: z.string().optional(),
  packageFirstDueDate: z.string().optional(),
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
).superRefine((data, ctx) => {
  // Venda do pacote junto do cadastro: mesmos campos e regras de "Vender pacote".
  if (!isPackageSale(data)) return;
  if (!data.packageId) ctx.addIssue({ code: "custom", path: ["packageId"], message: "Selecione o pacote." });
  const price = data.packagePriceCents ?? 0;
  if (!Number.isInteger(price) || price < 1) {
    ctx.addIssue({ code: "custom", path: ["packagePriceCents"], message: "Informe o valor." });
  } else if (price < Number(data.packageInstallments || 1)) {
    ctx.addIssue({
      code: "custom",
      path: ["packageInstallments"],
      message: "Cada parcela precisa de pelo menos R$ 0,01.",
    });
  }
  if (!DATE_RE.test(data.packageFirstDueDate ?? "")) {
    ctx.addIssue({ code: "custom", path: ["packageFirstDueDate"], message: "Informe o 1º vencimento." });
  }
});

/** O cadastro vende o pacote escolhido (opcao "Pacote de aulas" no aluno novo). */
export function isPackageSale(data: { paymentMode?: string; sellsPackage?: boolean }): boolean {
  return data.paymentMode === "package" && Boolean(data.sellsPackage);
}

function isPartialScholarship(data: { paymentMode?: string; scholarshipKind?: string }): boolean {
  return data.paymentMode === "scholarship" && data.scholarshipKind === "partial";
}

export type ClientFormValues = z.infer<typeof clientFormSchema>;


export type ClientPaymentMode = NonNullable<ClientFormValues["paymentMode"]>;

/**
 * Forma de pagamento inicial do formulario. Fora do modelo de turmas nao ha
 * escolha. Aluno salvo mantem o que tem: bolsa, com plano = "Paga
 * mensalidade", sem plano com pacote em uso = "Pacote de aulas", sem nada =
 * "Não paga mensalidade". Aluno novo segue a area: mensalidade comeca em
 * "Paga mensalidade", pacote em "Pacote de aulas"; curso e sem cobranca
 * comecam sem mensalidade.
 */
export function defaultPaymentMode({
  client,
  isClasses,
  areaBillingMode,
  hasActivePackage = false,
}: {
  client?: { planId?: string; discount?: { scholarship?: boolean } };
  isClasses: boolean;
  /** Forma de cobranca padrao da area (`defaultBillingMode`). */
  areaBillingMode: ClassBillingMode;
  /** Aluno salvo com pacote em uso (ativo, com saldo e valido). */
  hasActivePackage?: boolean;
}): ClientPaymentMode | undefined {
  if (!isClasses) return undefined;
  if (client?.discount?.scholarship) return "scholarship";
  if (client) return client.planId ? "membership" : hasActivePackage ? "package" : "none";
  if (areaBillingMode === "membership") return "membership";
  return areaBillingMode === "package" ? "package" : "none";
}
