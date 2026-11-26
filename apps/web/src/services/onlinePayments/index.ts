import { delegateAll } from "../world/delegate";
import { onlineChargesService } from "./onlineChargesService";
import { onlineSettingsService } from "./onlineSettingsService";
import { recurringService } from "./recurringService";

export { onlineChargesService, onlineSettingsService, recurringService };
export {
  DEFAULT_PIX_EXPIRES_IN_MINUTES,
  cancelOnlinePaymentsForCharge,
  type OnlineChargeCheckout,
  type UpdateOnlinePaymentSettings,
} from "./onlinePaymentRules";
export { applyRecurringAutoPayments } from "./recurringRules";

/** Objeto legado: configuracao + cobrancas online + Pix Automatico (mesmos metodos de antes). */
export const onlinePaymentsServiceImpl = {
  ...onlineSettingsService,
  ...onlineChargesService,
  ...recurringService,
};

/** Conta real no navegador: roda no servidor sobre o banco (doc 15, fatia 2). */
export const onlinePaymentsService = delegateAll("onlinePayments", onlinePaymentsServiceImpl, ["getSettings", "syncSubaccountApproved", "updateSettings", "simulatePaid", "refundOnline", "getRecurringForStudent", "listActiveRecurring", "requestRecurring", "simulateAuthorize", "revokeRecurring"]);
