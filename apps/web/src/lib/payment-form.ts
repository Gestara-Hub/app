import { z } from "zod";
import { RECEIPT_FILE_RULES, filesSchema } from "./files";

/**
 * Formulario de registrar pagamento (mensalidade, lancamento, professor):
 * forma obrigatoria + comprovantes opcionais (imagem ou PDF). Lancamentos
 * guardam os arquivos (anexos); mensalidade e professor ainda recebem so a forma.
 */
export const paymentFormSchema = z.object({
  method: z.enum(["pix", "cash", "card", "other"], { error: "Selecione a forma de pagamento." }),
  receipts: filesSchema(RECEIPT_FILE_RULES),
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;
