import { z } from "zod";
import { isValidCpfOrCnpj } from "@gestarahub/core/payer";

export const subscriptionCheckoutSchema = z
  .object({
    customerName: z
      .string()
      .trim()
      .min(3, "Informe a razão social ou nome do titular (mínimo 3 letras)."),
    customerEmail: z
      .string()
      .trim()
      .email("Informe um e-mail válido para recibos e faturas."),
    customerCpfCnpj: z
      .string()
      .trim()
      .min(1, "Informe o CPF ou CNPJ.")
      .refine(
        (val) => isValidCpfOrCnpj(val),
        "CPF ou CNPJ inválido. Confira os números.",
      ),
    customerPhone: z.string().optional(),
    billingType: z.enum(["PIX", "CREDIT_CARD"]),
    // Campos opcionais no schema base, validados no superRefine se for Cartão
    cardNumber: z.string().optional(),
    cardHolder: z.string().optional(),
    cardExpiry: z.string().optional(),
    cardCvv: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.billingType === "CREDIT_CARD") {
      const cleanCard = (data.cardNumber || "").replace(/\D/g, "");
      if (cleanCard.length < 13 || cleanCard.length > 19) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cardNumber"],
          message: "Número de cartão de crédito inválido.",
        });
      }

      if (!data.cardHolder || data.cardHolder.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cardHolder"],
          message: "Informe o nome exatamente como impresso no cartão.",
        });
      }

      const expiry = (data.cardExpiry || "").trim();
      const parts = expiry.split("/");
      if (
        parts.length !== 2 ||
        !/^\d{2}$/.test(parts[0] || "") ||
        !/^\d{2}$/.test(parts[1] || "")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cardExpiry"],
          message: "Validade inválida (use o formato MM/AA).",
        });
      }

      const cvv = (data.cardCvv || "").trim();
      if (cvv.length < 3 || cvv.length > 4 || !/^\d+$/.test(cvv)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cardCvv"],
          message: "Código de segurança (CVV) inválido (3 ou 4 dígitos).",
        });
      }
    }
  });

export type SubscriptionCheckoutFormValues = z.infer<
  typeof subscriptionCheckoutSchema
>;
