// Shim: a conta do gateway vive em ./onlinePayments (doc 12, fase 6).
export {
  GESTARAHUB_WEBHOOK_NAME,
  ensureSubaccountWebhook,
  recheckFeesAfterPayment,
  refreshGatewayIfNeeded,
  syncGatewayFees,
} from "./onlinePayments/gatewaySetup";
export {
  cancelGatewayPayment,
  expireAllDueOnlinePayments,
  expireDueOnlinePayments,
  retryAllPendingGatewayCancels,
  retryPendingGatewayCancels,
  subaccountKeyOf,
} from "./onlinePayments/gatewayCleanup";
export type {
  GatewayCancelResult,
} from "./onlinePayments/gatewayCleanup";
