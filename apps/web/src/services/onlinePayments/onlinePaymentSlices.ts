import type { MethodSlice } from "../world/slices";

/**
 * Recortes do pagamento online (doc 19, fase 2). O Pix Automatico de um aluno
 * nao le nada do historico do espaco.
 */
export const onlinePaymentSlices: Record<string, MethodSlice> = {
  getRecurringForStudent: async () => undefined,
};
