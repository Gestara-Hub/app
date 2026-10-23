import {
  checkUserLegalConsentAction,
  recordLegalConsentAction,
  confirmMinorConsentAction,
  confirmPaperMinorConsentAction,
  getPublicMinorConsentDetailsAction,
  type ConfirmMinorConsentInput,
} from "./actions";
import {
  CURRENT_PLATFORM_TERMS_VERSION,
  CURRENT_SUBACCOUNT_TERMS_VERSION,
  type ConsentType,
  type LegalConsentResult,
  type RecordLegalConsentInput,
} from "@gestarahub/contracts";

export const legalConsentService = {
  checkConsent: async (
    userId?: string,
    consentType: ConsentType = "platform_terms",
    requiredVersion = CURRENT_PLATFORM_TERMS_VERSION,
  ): Promise<{ accepted: boolean; acceptedAt?: string }> => {
    return checkUserLegalConsentAction(userId, consentType, requiredVersion);
  },

  recordConsent: async (
    input: RecordLegalConsentInput,
  ): Promise<LegalConsentResult> => {
    return recordLegalConsentAction(input);
  },

  confirmMinorConsent: async (
    input: ConfirmMinorConsentInput,
  ): Promise<{ success: boolean; error?: string }> => {
    return confirmMinorConsentAction(input);
  },

  confirmPaperMinorConsent: async (
    studentId: string,
    guardianName?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    return confirmPaperMinorConsentAction(studentId, guardianName);
  },

  getPublicMinorConsentDetails: async (studentId: string) => {
    return getPublicMinorConsentDetailsAction(studentId);
  },

  CURRENT_PLATFORM_TERMS_VERSION,
  CURRENT_SUBACCOUNT_TERMS_VERSION,
};
