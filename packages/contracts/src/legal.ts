import type { DateTimeISO, Id } from "./common";

export const CURRENT_PLATFORM_TERMS_VERSION = "v1.0-2026-10";
// v1.1 (22/10/2026): tarifa do parceiro separada da taxa do GestaraHub,
// repasse ao aluno e dados enviados para abrir a conta.
export const CURRENT_SUBACCOUNT_TERMS_VERSION = "subaccount-v1.1";

export type ConsentType =
  | "platform_terms"
  | "privacy_policy"
  | "subaccount_brokerage"
  | "minor_guardian";

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
