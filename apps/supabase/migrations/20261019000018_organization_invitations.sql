-- =============================================================================
-- Migration 18: Organization Invitations (Convites de Equipe por E-mail)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id text REFERENCES public.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  profile text NOT NULL CHECK (profile IN ('owner', 'manager', 'attendant', 'professional')),
  professional_id text,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON public.organization_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_org_invitations_org_email ON public.organization_invitations(organization_id, lower(email));

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_org_invitations_updated_at ON public.organization_invitations;
CREATE TRIGGER trg_org_invitations_updated_at
  BEFORE UPDATE ON public.organization_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
