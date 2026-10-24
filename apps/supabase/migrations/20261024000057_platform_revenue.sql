-- =============================================================================
-- Migration: 20261024000057_platform_revenue.sql
-- Description: Receita e ativacao no painel (doc technical/26, fase 7). Visoes
--   agregadas (dono do banco): o painel recebe so totais, nunca linha de aluno
--   nem de cobranca.
-- =============================================================================

-- Funil de ativacao: de quantos espacos criados, quantos chegaram a cada passo.
CREATE OR REPLACE VIEW platform.revenue_funnel AS
SELECT count(*)::int AS spaces_total,
       count(*) FILTER (WHERE s.students_total > 0)::int AS with_students,
       count(*) FILTER (WHERE s.classes_active > 0)::int AS with_classes,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.charges c WHERE c.organization_id = o.id))::int AS with_charges,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.online_payments p WHERE p.organization_id = o.id AND p.status = 'paid'))::int AS with_online_paid,
       count(*) FILTER (WHERE coalesce(o.subscription->>'tier', 'free') <> 'free' AND NOT (o.subscription ? 'courtesyUntil'))::int AS paying,
       count(*) FILTER (WHERE a.last_sign_in_at >= now() - interval '30 days')::int AS active_30d,
       count(*) FILTER (WHERE coalesce(o.subscription->>'tier', 'free') <> 'free' AND NOT (o.subscription ? 'courtesyUntil')
                          AND a.last_sign_in_at >= now() - interval '30 days')::int AS paying_active_30d
  FROM public.organizations o
  JOIN platform.space_stats s ON s.organization_id = o.id
  LEFT JOIN platform.space_activity a ON a.organization_id = o.id
 WHERE o.status = 'active';

-- Espacos criados por mes
CREATE OR REPLACE VIEW platform.spaces_created_monthly AS
SELECT to_char(created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS month, count(*)::int AS created
  FROM public.organizations GROUP BY 1;

-- Pagamentos online por mes: volume e a taxa que fica com a plataforma
CREATE OR REPLACE VIEW platform.online_revenue_monthly AS
SELECT to_char(coalesce(paid_at, created_at) AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS month,
       count(*)::int AS paid_count,
       coalesce(sum(amount_cents), 0)::bigint AS volume_cents,
       coalesce(sum(split_amount_cents), 0)::bigint AS fee_cents
  FROM public.online_payments WHERE status = 'paid' GROUP BY 1;

GRANT SELECT ON platform.revenue_funnel, platform.spaces_created_monthly, platform.online_revenue_monthly TO platform_app;
