import { z } from "zod";
import { RECEIPT_FILE_RULES, filesSchema } from "./files";

/**
 * Formulario de registrar pagamento (mensalidade, lancamento, professor):
 * forma obrigatoria + comprovantes opcionais (imagem ou PDF). Os arquivos ainda
 * nao sao enviados: o mock so recebe a forma; o upload entra com o backend.
 */
export const paymentFormSchema = z.object({
  method: z.enum(["pix", "cash", "card", "other"], { error: "Selecione a forma de pagamento." }),
  receipts: filesSchema(RECEIPT_FILE_RULES),
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;
