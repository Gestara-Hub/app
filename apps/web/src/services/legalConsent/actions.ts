// Acoes de servidor dos aceites (plataforma e responsavel), num import so.
export {
  checkUserLegalConsentAction,
  recordLegalConsentAction,
} from "./platformConsentActions";
export {
  confirmMinorConsentAction,
  confirmPaperMinorConsentAction,
  getPublicMinorConsentDetailsAction,
} from "./minorConsentActions";
export type {
  ConfirmMinorConsentInput,
} from "./minorConsentActions";
