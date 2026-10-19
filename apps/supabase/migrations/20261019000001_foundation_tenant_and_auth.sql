-- =============================================================================
-- Migration 01: Foundation — Organizations, Units, Roles, Users, Categories & RLS
-- =============================================================================

-- 1. Automatic updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Organizations (Tenant root)
CREATE TABLE public.organizations (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  segment text NOT NULL DEFAULT 'Academia',
  model text NOT NULL DEFAULT 'classes' CHECK (model IN ('scheduling', 'classes', 'delivery')),
  class_segment text CHECK (
    class_segment IS NULL OR class_segment IN (
      'martial_arts',
      'pilates_yoga',
      'functional_training',
      'dance',
      'music',
      'languages',
      'swimming_sports',
      'gastronomy',
      'arts_crafts',
      'beauty_courses',
      'custom'
    )
  ),
  custom_segment_name text,
  custom_segment_progression text CHECK (
    custom_segment_progression IS NULL OR custom_segment_progression IN ('belts', 'levels', 'modules', 'none')
  ),
  custom_segment_billing text CHECK (
    custom_segment_billing IS NULL OR custom_segment_billing IN ('membership', 'course', 'package', 'free')
  ),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  subscription jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Units (Branches / locations of an organization)
CREATE TABLE public.units (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  address jsonb,
  phone text,
  business_hours jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_units_organization_id ON public.units(organization_id);

CREATE TRIGGER trg_units_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Roles (Job titles for professionals)
CREATE TABLE public.roles (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_roles_organization_id ON public.roles(organization_id);

CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Users (App users linked to auth.users and scoped to an organization)
CREATE TABLE public.users (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  profile text NOT NULL CHECK (profile IN ('owner', 'manager', 'attendant', 'professional')),
  professional_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

CREATE INDEX idx_users_organization_id ON public.users(organization_id);
CREATE INDEX idx_users_auth_user_id ON public.users(auth_user_id);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Categories / Modalities
CREATE TABLE public.categories (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  progression_track jsonb,
  assessments jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_organization_id ON public.categories(organization_id);

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Signup Tokens (24h single-use links for account creation & password setup)
CREATE TABLE public.signup_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'consumed', 'revoked')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_signup_tokens_email_status ON public.signup_tokens(lower(email), status);
CREATE INDEX idx_signup_tokens_token_hash ON public.signup_tokens(token_hash);

CREATE TRIGGER trg_signup_tokens_updated_at
  BEFORE UPDATE ON public.signup_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.signup_tokens ENABLE ROW LEVEL SECURITY;
-- signup_tokens is accessed exclusively via service_role on the server.

-- =============================================================================
-- Row-Level Security (RLS) Helpers & Policies
-- =============================================================================

-- Resolves the active organization_id for the authenticated user.
CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.users
  WHERE auth_user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$;

-- Resolves the RBAC profile ('owner' | 'manager' | 'attendant' | 'professional') for the authenticated user.
CREATE OR REPLACE FUNCTION public.current_user_profile()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT profile
  FROM public.users
  WHERE auth_user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Organizations policies
CREATE POLICY organizations_select_own ON public.organizations
  FOR SELECT TO authenticated
  USING (id = public.current_organization_id());

CREATE POLICY organizations_update_own ON public.organizations
  FOR UPDATE TO authenticated
  USING (id = public.current_organization_id() AND public.current_user_profile() IN ('owner', 'manager'))
  WITH CHECK (id = public.current_organization_id() AND public.current_user_profile() IN ('owner', 'manager'));

-- Units policies
CREATE POLICY units_select_own ON public.units
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY units_manage_own ON public.units
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND public.current_user_profile() IN ('owner', 'manager'))
  WITH CHECK (organization_id = public.current_organization_id() AND public.current_user_profile() IN ('owner', 'manager'));

-- Roles policies
CREATE POLICY roles_select_own ON public.roles
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY roles_manage_own ON public.roles
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND public.current_user_profile() IN ('owner', 'manager'))
  WITH CHECK (organization_id = public.current_organization_id() AND public.current_user_profile() IN ('owner', 'manager'));

-- Users policies
CREATE POLICY users_select_own ON public.users
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY users_manage_own ON public.users
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND public.current_user_profile() = 'owner')
  WITH CHECK (organization_id = public.current_organization_id() AND public.current_user_profile() = 'owner');

-- Categories / Modalities policies
CREATE POLICY categories_select_own ON public.categories
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY categories_manage_own ON public.categories
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND public.current_user_profile() IN ('owner', 'manager'))
  WITH CHECK (organization_id = public.current_organization_id() AND public.current_user_profile() IN ('owner', 'manager'));
