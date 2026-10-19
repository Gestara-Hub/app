-- Migration: 20261019000003_security_rate_limits_and_audit.sql
-- Description: Rate limiting engine (anti-brute-force/DDoS) and immutable Audit Log table with RLS

-- =============================================================================
-- 1. Rate Limiting Engine
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY,
  points integer NOT NULL DEFAULT 1,
  expire_at timestamptz NOT NULL
);

-- Periodically cleans up expired keys or relies on upsert overwrite
CREATE INDEX IF NOT EXISTS idx_rate_limits_expire_at ON public.rate_limits(expire_at);

-- Atomic sliding-window rate limit checker
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_max_points integer,
  p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_current_points integer;
  v_expire_at timestamptz;
BEGIN
  -- Insert or increment points atomically
  INSERT INTO public.rate_limits (key, points, expire_at)
  VALUES (p_key, 1, v_now + (p_window_seconds || ' seconds')::interval)
  ON CONFLICT (key) DO UPDATE
  SET
    points = CASE
      WHEN public.rate_limits.expire_at <= v_now THEN 1
      ELSE public.rate_limits.points + 1
    END,
    expire_at = CASE
      WHEN public.rate_limits.expire_at <= v_now THEN v_now + (p_window_seconds || ' seconds')::interval
      ELSE public.rate_limits.expire_at
    END
  RETURNING points INTO v_current_points;

  IF v_current_points > p_max_points THEN
    RETURN false; -- Rate limit exceeded
  END IF;

  RETURN true; -- Allowed
END;
$$;

-- Resets rate limit for a key (e.g. after successful authentication)
CREATE OR REPLACE FUNCTION public.reset_rate_limit(p_key text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limits WHERE key = p_key;
$$;

-- Rate limits table is only accessible via security definer functions or service_role
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. Audit Logs Table (Append-only & Immutable)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id text,
  timestamp timestamptz NOT NULL DEFAULT now(),
  actor jsonb NOT NULL,
  action text NOT NULL,
  target jsonb NOT NULL,
  summary text NOT NULL,
  changes jsonb,
  security boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_timestamp
  ON public.audit_logs(organization_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target
  ON public.audit_logs USING gin(target);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Tenants can only view their own audit logs
CREATE POLICY audit_logs_isolation_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

-- Tenants can insert audit records for their own organization
CREATE POLICY audit_logs_isolation_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_organization_id());

-- IMPORTANT: No UPDATE or DELETE policy exists for authenticated users.
-- Audit logs are strictly append-only and cannot be altered or deleted.
