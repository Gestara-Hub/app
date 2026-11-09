-- =============================================================================
-- Migration: 20261109000092_event_certificates.sql
-- Description: Certificado de participacao em evento (doc product/29, fase 5,
--   Plano Profissional). Mesma tabela issued_certificates, com kind 'event' e
--   a inscricao e o evento no lugar da matricula. Um certificado por inscricao.
-- =============================================================================

ALTER TABLE public.issued_certificates DROP CONSTRAINT IF EXISTS issued_certificates_kind_check;
ALTER TABLE public.issued_certificates
  ADD CONSTRAINT issued_certificates_kind_check CHECK (kind IN ('course', 'graduation', 'event'));
ALTER TABLE public.issued_certificates
  ADD COLUMN IF NOT EXISTS event_registration_id text REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS event_id text REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE public.issued_certificates DROP CONSTRAINT IF EXISTS chk_issued_certificates_source;
ALTER TABLE public.issued_certificates
  ADD CONSTRAINT chk_issued_certificates_source CHECK (
    (kind = 'course' AND enrollment_id IS NOT NULL AND class_group_id IS NOT NULL)
    OR (kind = 'graduation' AND promotion_id IS NOT NULL)
    OR (kind = 'event' AND event_registration_id IS NOT NULL AND event_id IS NOT NULL)
  );
CREATE UNIQUE INDEX IF NOT EXISTS uq_issued_certificates_event_registration
  ON public.issued_certificates(organization_id, event_registration_id)
  WHERE event_registration_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_issued_certificates_event
  ON public.issued_certificates(organization_id, event_id)
  WHERE event_id IS NOT NULL;
