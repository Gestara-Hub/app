-- Migration: Legal Consents and Audit Trail (LGPD, Marco Civil, BACEN)
-- Records electronic acceptance of Terms of Use, Privacy Policy, and Financial Brokerage Contracts.

-- 1. Table for electronic legal consents
CREATE TABLE IF NOT EXISTS public.legal_consents (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (consent_type IN ('platform_terms', 'privacy_policy', 'subaccount_brokerage')),
  terms_version text NOT NULL,
  ip_address text,
  user_agent text,
  document_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_consents_user_type ON public.legal_consents(user_id, consent_type);
CREATE INDEX IF NOT EXISTS idx_legal_consents_org_id ON public.legal_consents(organization_id);

-- 2. Add quick consent columns to users table for fast session checking
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text;

-- 3. Row Level Security (RLS)
ALTER TABLE public.legal_consents ENABLE ROW LEVEL SECURITY;

-- Tenants can only view their own legal consents
CREATE POLICY legal_consents_isolation_select ON public.legal_consents
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

-- Tenants can insert consent records for their own organization
CREATE POLICY legal_consents_isolation_insert ON public.legal_consents
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_organization_id());

-- IMPORTANT: No UPDATE or DELETE policy exists for authenticated users.
-- Legal consents are strictly append-only and immutable for regulatory auditability (LGPD/Marco Civil).
