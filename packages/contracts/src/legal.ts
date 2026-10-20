import type { DateTimeISO, Id } from "./common";

export const CURRENT_PLATFORM_TERMS_VERSION = "v1.0-2026-10";
export const CURRENT_SUBACCOUNT_TERMS_VERSION = "subaccount-v1.0";

export type ConsentType =
  | "platform_terms"
  | "privacy_policy"
  | "subaccount_brokerage";

export interface LegalConsent {
  id: Id;
  organizationId: Id;
  userId: Id;
  consentType: ConsentType;
  termsVersion: string;
  ipAddress?: string;
  userAgent?: string;
  documentHash?: string;
  metadata?: Record<string, unknown>;
  acceptedAt: DateTimeISO;
}

export interface RecordLegalConsentInput {
  consentType: ConsentType;
  termsVersion: string;
  organizationId?: string;
  userId?: string;
  documentHash?: string;
  metadata?: Record<string, unknown>;
}

export interface LegalConsentResult {
  success: boolean;
  consentId?: string;
  acceptedAt?: string;
  error?: string;
}
