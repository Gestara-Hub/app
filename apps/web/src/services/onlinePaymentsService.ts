// Shim: o dominio de pagamento online vive em ./onlinePayments (doc 12, fase 6).
export {
  DEFAULT_PIX_EXPIRES_IN_MINUTES,
  applyRecurringAutoPayments,
  cancelOnlinePaymentsForCharge,
  onlinePaymentsService,
  onlinePaymentsServiceImpl,
  type OnlineChargeCheckout,
  type UpdateOnlinePaymentSettings,
} from "./onlinePayments";
