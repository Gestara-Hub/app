import { format } from "date-fns";
import { z } from "zod";
import { RECEIPT_FILE_RULES, filesSchema } from "./files";

/**
 * Formulario de registrar pagamento (mensalidade, lancamento, professor):
 * forma obrigatoria, dia do pagamento (padrao hoje, nunca no futuro) e
 * comprovantes opcionais (imagem ou PDF), guardados no registro pago.
 */
export const paymentFormSchema = z.object({
  method: z.enum(["pix", "cash", "card", "other"], { error: "Selecione a forma de pagamento." }),
  paidOn: z
    .string()
    .min(1, "Informe a data do pagamento.")
    .refine((value) => value <= format(new Date(), "yyyy-MM-dd"), "A data do pagamento não pode ser futura."),
  receipts: filesSchema(RECEIPT_FILE_RULES),
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;
