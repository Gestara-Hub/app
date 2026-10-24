-- =============================================================================
-- Migration: 20261024000056_platform_support_access.sql
-- Description: "Entrar como suporte" (doc technical/26, fase 8). Nao e login no
--   espaco: e uma visao SOMENTE LEITURA, com motivo e 30 minutos, montada so de
--   configuracao e totais (nenhum nome, telefone, e-mail ou CPF de aluno). Abrir
--   a visao registra na Auditoria do espaco (o dono enxerga) e na do painel.
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform.support_access_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  admin_id uuid,
  admin_name text NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) >= 5),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  ended_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_support_access_org ON platform.support_access_sessions (organization_id, started_at DESC);
ALTER TABLE platform.support_access_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_access_platform_app ON platform.support_access_sessions FOR SELECT TO platform_app USING (true);
GRANT SELECT ON platform.support_access_sessions TO platform_app;

CREATE OR REPLACE FUNCTION platform.start_support_access(
  p_org text, p_reason text, p_admin uuid, p_admin_name text, p_ip text, p_ua text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
DECLARE
  v_id uuid;
  v_label text := 'Suporte do GestaraHub';
BEGIN
  IF length(trim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Diga o motivo do acesso.' USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.organizations WHERE id = p_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'Espaço não encontrado.' USING ERRCODE = 'P0002'; END IF;
  -- Uma visao aberta por pessoa: abrir outra encerra a anterior.
  UPDATE platform.support_access_sessions SET ended_at = now() WHERE admin_id = p_admin AND ended_at IS NULL AND expires_at > now();
  INSERT INTO platform.support_access_sessions (organization_id, admin_id, admin_name, reason)
  VALUES (p_org, p_admin, p_admin_name, trim(p_reason)) RETURNING id INTO v_id;
  INSERT INTO public.audit_logs (id, organization_id, actor, action, target, summary, changes, security, source)
  VALUES (gen_random_uuid(), p_org,
          jsonb_build_object('kind', 'system', 'userId', 'platform', 'name', v_label, 'profile', 'owner'),
          'updated', jsonb_build_object('type', 'space', 'id', p_org, 'label', 'Visão de suporte'),
          v_label || ' abriu uma visão de suporte (somente leitura, 30 minutos): ' || trim(p_reason), NULL, true, 'platform');
  INSERT INTO platform.audit_logs (admin_id, admin_name, action, organization_id, target, reason, ip, user_agent)
  VALUES (p_admin, p_admin_name, 'support_access.start', p_org, jsonb_build_object('sessionId', v_id), p_reason, p_ip, p_ua);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION platform.end_support_access(p_session uuid, p_admin uuid, p_admin_name text, p_ip text, p_ua text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
DECLARE v_org text;
BEGIN
  UPDATE platform.support_access_sessions SET ended_at = now()
   WHERE id = p_session AND admin_id = p_admin AND ended_at IS NULL RETURNING organization_id INTO v_org;
  IF v_org IS NULL THEN RETURN; END IF;
  INSERT INTO platform.audit_logs (admin_id, admin_name, action, organization_id, target, ip, user_agent)
  VALUES (p_admin, p_admin_name, 'support_access.end', v_org, jsonb_build_object('sessionId', p_session), p_ip, p_ua);
END $$;

-- A visao: so totais e configuracao. Vale para a pessoa que abriu, enquanto a sessao esta aberta.
CREATE OR REPLACE FUNCTION platform.support_view(p_session uuid, p_admin uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, platform AS $$
DECLARE
  v_org text;
  v_expires timestamptz;
  v jsonb;
BEGIN
  SELECT organization_id, expires_at INTO v_org, v_expires FROM platform.support_access_sessions
   WHERE id = p_session AND admin_id = p_admin AND ended_at IS NULL AND expires_at > now();
  IF v_org IS NULL THEN RAISE EXCEPTION 'A visão de suporte terminou. Abra de novo, com o motivo.' USING ERRCODE = '22023'; END IF;
  SELECT jsonb_build_object(
    'organizationId', v_org,
    'expiresAt', v_expires,
    'space', (SELECT jsonb_build_object('name', o.name, 'model', o.model, 'area', o.class_segment, 'customArea', o.custom_segment_name,
                                        'status', o.status, 'createdAt', o.created_at, 'subscription', o.subscription,
                                        'timeZone', o.settings->>'timeZone',
                                        'onlinePayments', coalesce(o.gateway_status, 'not_configured'))
                FROM public.organizations o WHERE o.id = v_org),
    'units', (SELECT count(*) FROM public.units WHERE organization_id = v_org AND status = 'active'),
    'people', (SELECT coalesce(jsonb_object_agg(profile || ':' || status, n), '{}'::jsonb)
               FROM (SELECT profile, status, count(*) AS n FROM public.users WHERE organization_id = v_org GROUP BY 1, 2) x),
    'owner', (SELECT jsonb_build_object('termsVersion', u.terms_version, 'termsAcceptedAt', u.terms_accepted_at)
              FROM public.users u WHERE u.organization_id = v_org AND u.profile = 'owner' ORDER BY u.created_at LIMIT 1),
    'students', (SELECT coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                 FROM (SELECT status, count(*) AS n FROM public.clients WHERE organization_id = v_org GROUP BY 1) x),
    'professionals', (SELECT coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                      FROM (SELECT status, count(*) AS n FROM public.professionals WHERE organization_id = v_org GROUP BY 1) x),
    'enrollments', (SELECT coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                    FROM (SELECT status, count(*) AS n FROM public.enrollments WHERE organization_id = v_org GROUP BY 1) x),
    'classes', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'status', c.status, 'capacity', c.capacity,
                        'enrolled', (SELECT count(*) FROM public.enrollments e WHERE e.class_group_id = c.id AND e.status = 'active'),
                        'billingMode', c.billing_mode, 'slots', jsonb_array_length(coalesce(c.meeting_slots, '[]'::jsonb))) ORDER BY c.name), '[]'::jsonb)
                FROM public.class_groups c WHERE c.organization_id = v_org),
    'plans', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'priceCents', p.price_cents, 'period', p.period, 'status', p.status) ORDER BY p.name), '[]'::jsonb)
              FROM public.plans p WHERE p.organization_id = v_org),
    'charges', (SELECT coalesce(jsonb_agg(jsonb_build_object('competence', competence, 'status', status, 'count', n, 'totalCents', total) ORDER BY competence DESC, status), '[]'::jsonb)
                FROM (SELECT competence, status, count(*) AS n, coalesce(sum(amount_cents), 0) AS total
                        FROM public.charges WHERE organization_id = v_org AND created_at > now() - interval '6 months' GROUP BY 1, 2) x),
    'onlinePaymentsByStatus', (SELECT coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                               FROM (SELECT status, count(*) AS n FROM public.online_payments WHERE organization_id = v_org GROUP BY 1) x)
  ) INTO v;
  RETURN v;
END $$;

REVOKE ALL ON FUNCTION platform.start_support_access(text, text, uuid, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION platform.end_support_access(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION platform.support_view(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION platform.start_support_access(text, text, uuid, text, text, text) TO platform_app;
GRANT EXECUTE ON FUNCTION platform.end_support_access(uuid, uuid, text, text, text) TO platform_app;
GRANT EXECUTE ON FUNCTION platform.support_view(uuid, uuid) TO platform_app;
