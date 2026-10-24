-- =============================================================================
-- Migration: 20261024000052_platform_spaces.sql
-- Description: Espacos (tenants) e Saude no painel admin (doc technical/26, fases 2 e 4).
--   O painel nunca le tabelas de alunos: ve contagens por visoes agregadas do
--   schema `platform` (dono do banco) e so as colunas de `organizations` que
--   nao guardam segredo. Erros, rotinas e avisos do parceiro (ja mascarados) e o
--   historico do plano entram por politica de leitura so para `platform_app`.
-- =============================================================================

-- 1. organizations: so as colunas sem segredo (nada de chave, conta ou carteira do gateway)
REVOKE SELECT ON public.organizations FROM platform_app;
GRANT SELECT (id, name, segment, model, class_segment, custom_segment_name, custom_segment_progression,
              custom_segment_billing, settings, subscription, status, created_at, updated_at,
              gateway_provider, gateway_status, gateway_fees_synced_at)
  ON public.organizations TO platform_app;

-- 2. Leitura (so platform_app) do que ja e mascarado ou nao tem dado pessoal
GRANT SELECT ON public.subscription_events, public.error_logs, public.job_runs, public.webhook_events TO platform_app;
CREATE POLICY subscription_events_platform_app_select ON public.subscription_events FOR SELECT TO platform_app USING (true);
CREATE POLICY error_logs_platform_app_select ON public.error_logs FOR SELECT TO platform_app USING (true);
CREATE POLICY job_runs_platform_app_select ON public.job_runs FOR SELECT TO platform_app USING (true);
CREATE POLICY webhook_events_platform_app_select ON public.webhook_events FOR SELECT TO platform_app USING (true);

-- 3. Visoes agregadas (executam como dono: o painel nao ganha acesso as tabelas de origem)
CREATE OR REPLACE VIEW platform.space_stats AS
SELECT o.id AS organization_id,
       (SELECT count(*) FROM public.clients c WHERE c.organization_id = o.id AND c.status = 'active')::int AS students_active,
       (SELECT count(*) FROM public.clients c WHERE c.organization_id = o.id)::int AS students_total,
       (SELECT count(*) FROM public.class_groups g WHERE g.organization_id = o.id AND g.status = 'active')::int AS classes_active,
       (SELECT count(*) FROM public.professionals p WHERE p.organization_id = o.id AND p.status = 'active')::int AS teachers_active,
       (SELECT count(*) FROM public.users u WHERE u.organization_id = o.id AND u.status = 'active')::int AS users_active,
       (SELECT count(*) FROM public.charges ch WHERE ch.organization_id = o.id AND ch.status IN ('pending', 'overdue'))::int AS charges_open,
       (SELECT coalesce(sum(ch.amount_cents), 0) FROM public.charges ch WHERE ch.organization_id = o.id AND ch.status IN ('pending', 'overdue'))::bigint AS charges_open_cents,
       (SELECT max(a.marked_at) FROM public.attendances a WHERE a.organization_id = o.id) AS last_attendance_at
  FROM public.organizations o;

CREATE OR REPLACE VIEW platform.space_owners AS
SELECT DISTINCT ON (u.organization_id)
       u.organization_id, u.name AS owner_name, u.email AS owner_email, u.auth_user_id, u.terms_accepted_at, u.terms_version
  FROM public.users u
 WHERE u.profile = 'owner' AND u.status = 'active'
 ORDER BY u.organization_id, u.created_at;

-- Ultimo acesso: o mais recente entre as pessoas ativas do espaco (da autenticacao).
CREATE OR REPLACE VIEW platform.space_activity AS
SELECT u.organization_id, max(a.last_sign_in_at) AS last_sign_in_at
  FROM public.users u JOIN auth.users a ON a.id = u.auth_user_id
 WHERE u.status = 'active'
 GROUP BY u.organization_id;

-- Pagamentos online dos ultimos 30 dias: so contagem e valor (sem aluno).
CREATE OR REPLACE VIEW platform.space_online_30d AS
SELECT p.organization_id,
       count(*) FILTER (WHERE p.status = 'paid')::int AS paid_count,
       coalesce(sum(p.amount_cents) FILTER (WHERE p.status = 'paid'), 0)::bigint AS paid_cents,
       count(*) FILTER (WHERE p.status = 'awaiting')::int AS awaiting_count,
       count(*) FILTER (WHERE p.status IN ('canceled', 'expired', 'failed'))::int AS lost_count,
       coalesce(sum(p.split_amount_cents) FILTER (WHERE p.status = 'paid'), 0)::bigint AS platform_fee_cents
  FROM public.online_payments p
 WHERE p.created_at >= now() - interval '30 days'
 GROUP BY p.organization_id;

GRANT SELECT ON platform.space_stats, platform.space_owners, platform.space_activity, platform.space_online_30d TO platform_app;

-- 4. Anotacoes internas sobre um espaco
CREATE TABLE IF NOT EXISTS platform.space_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  admin_id uuid,
  admin_name text,
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_space_notes_org ON platform.space_notes (organization_id, created_at DESC);
ALTER TABLE platform.space_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY space_notes_platform_app ON platform.space_notes FOR ALL TO platform_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON platform.space_notes TO platform_app;

-- 5. Erros conhecidos (silencia no painel; o resumo diario do app dos clientes segue o dele)
CREATE TABLE IF NOT EXISTS platform.known_errors (
  fingerprint text PRIMARY KEY,
  admin_id uuid,
  admin_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE platform.known_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY known_errors_platform_app ON platform.known_errors FOR ALL TO platform_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, DELETE ON platform.known_errors TO platform_app;
