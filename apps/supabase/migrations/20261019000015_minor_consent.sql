-- Migration: 20261019000015_minor_consent.sql
-- Description: Minor Student LGPD Consent (Art. 14 Lei 13.709/2018)
-- Adds minor consent columns to clients table and enables minor_guardian consent type in legal_consents.

-- 1. Add columns to clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS minor_consent_status text DEFAULT 'not_applicable' CHECK (minor_consent_status IN ('not_applicable', 'pending', 'confirmed_whatsapp', 'confirmed_paper')),
  ADD COLUMN IF NOT EXISTS minor_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS minor_consent_by text,
  ADD COLUMN IF NOT EXISTS minor_consent_evidence jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_clients_minor_consent ON public.clients(organization_id, minor_consent_status);

-- 2. Update legal_consents check constraint to allow minor_guardian
ALTER TABLE public.legal_consents DROP CONSTRAINT IF EXISTS legal_consents_consent_type_check;
ALTER TABLE public.legal_consents ADD CONSTRAINT legal_consents_consent_type_check
  CHECK (consent_type IN ('platform_terms', 'privacy_policy', 'subaccount_brokerage', 'minor_guardian'));
