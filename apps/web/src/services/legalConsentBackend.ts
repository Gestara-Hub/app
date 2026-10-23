// Shim: as acoes de aceite vivem em ./legalConsent (doc 12, fase 6).
export {
  checkUserLegalConsentAction,
  recordLegalConsentAction,
} from "./legalConsent/platformConsentActions";
export {
  confirmMinorConsentAction,
  confirmPaperMinorConsentAction,
  getPublicMinorConsentDetailsAction,
} from "./legalConsent/minorConsentActions";
export type {
  ConfirmMinorConsentInput,
} from "./legalConsent/minorConsentActions";
