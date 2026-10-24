-- =============================================================================
-- Migration: 20261024000054_platform_announcements.sql
-- Description: Comunicados do GestaraHub aos donos de espaco (doc technical/26,
--   fase 5): manutencao, novidade, termo novo, incidente. O painel cria; o app
--   dos clientes (servidor, chave de servico) le so os que valem para o espaco
--   da pessoa, pela funcao `public.announcements_for`, e registra a dispensa.
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 120),
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 3 AND 1000),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'urgent')),
  -- all: todos; tier: por plano; area: por area; spaces: espacos escolhidos.
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'tier', 'area', 'spaces')),
  -- {"tiers": ["free"]}, {"areas": ["dance"]} ou {"spaces": ["<id>"]}
  audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON platform.announcements (starts_at, ends_at) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS platform.announcement_reads (
  announcement_id uuid NOT NULL REFERENCES platform.announcements(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

ALTER TABLE platform.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.announcement_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY announcements_platform_app ON platform.announcements FOR ALL TO platform_app USING (true) WITH CHECK (true);
CREATE POLICY announcement_reads_platform_app ON platform.announcement_reads FOR SELECT TO platform_app USING (true);
GRANT SELECT, INSERT, UPDATE ON platform.announcements TO platform_app;
GRANT SELECT ON platform.announcement_reads TO platform_app;

-- O comunicado vale para este espaco? (a mesma regra no painel e no app dos clientes)
CREATE OR REPLACE FUNCTION platform.audience_matches(p_audience text, p_filter jsonb, p_org text, p_tier text, p_area text)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_audience
    WHEN 'all' THEN true
    WHEN 'tier' THEN coalesce(p_filter->'tiers', '[]'::jsonb) ? coalesce(p_tier, 'free')
    WHEN 'area' THEN p_area IS NOT NULL AND coalesce(p_filter->'areas', '[]'::jsonb) ? p_area
    WHEN 'spaces' THEN coalesce(p_filter->'spaces', '[]'::jsonb) ? p_org
    ELSE false
  END
$$;
GRANT EXECUTE ON FUNCTION platform.audience_matches(text, jsonb, text, text, text) TO platform_app;

-- Quantos espacos recebem (a previa do formulario)
CREATE OR REPLACE FUNCTION platform.audience_count(p_audience text, p_filter jsonb)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, platform AS $$
  SELECT count(*)::int FROM public.organizations o
   WHERE o.status = 'active'
     AND platform.audience_matches(p_audience, p_filter, o.id, coalesce(o.subscription->>'tier', 'free'), o.class_segment)
$$;
REVOKE ALL ON FUNCTION platform.audience_count(text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION platform.audience_count(text, jsonb) TO platform_app;

-- App dos clientes: os comunicados de hoje para esta pessoa (sem os que ela dispensou)
CREATE OR REPLACE FUNCTION public.announcements_for(p_org text, p_user text)
RETURNS TABLE (id uuid, title text, body text, severity text, starts_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, platform AS $$
  SELECT a.id, a.title, a.body, a.severity, a.starts_at
    FROM platform.announcements a
    JOIN public.organizations o ON o.id = p_org
   WHERE a.archived_at IS NULL
     AND a.starts_at <= now()
     AND (a.ends_at IS NULL OR a.ends_at > now())
     AND platform.audience_matches(a.audience, a.audience_filter, o.id, coalesce(o.subscription->>'tier', 'free'), o.class_segment)
     AND NOT EXISTS (SELECT 1 FROM platform.announcement_reads r WHERE r.announcement_id = a.id AND r.user_id = p_user)
   ORDER BY CASE a.severity WHEN 'urgent' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, a.starts_at DESC
   LIMIT 5
$$;

CREATE OR REPLACE FUNCTION public.announcement_dismiss(p_org text, p_user text, p_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, platform AS $$
  INSERT INTO platform.announcement_reads (announcement_id, user_id)
  SELECT a.id, p_user FROM platform.announcements a JOIN public.organizations o ON o.id = p_org
   WHERE a.id = p_id AND a.severity <> 'urgent'
     AND platform.audience_matches(a.audience, a.audience_filter, o.id, coalesce(o.subscription->>'tier', 'free'), o.class_segment)
  ON CONFLICT DO NOTHING
$$;

REVOKE ALL ON FUNCTION public.announcements_for(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.announcement_dismiss(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.announcements_for(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.announcement_dismiss(text, text, uuid) TO service_role;
