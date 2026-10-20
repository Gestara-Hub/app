import {
  checkUserLegalConsentAction,
  recordLegalConsentAction,
} from "./legalConsentBackend";
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

  CURRENT_PLATFORM_TERMS_VERSION,
  CURRENT_SUBACCOUNT_TERMS_VERSION,
};
