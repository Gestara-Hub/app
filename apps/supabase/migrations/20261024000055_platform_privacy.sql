-- =============================================================================
-- Migration: 20261024000055_platform_privacy.sql
-- Description: Equipe e LGPD do painel (doc technical/26, fase 6): pedidos do
--   titular de dados (prazo de 15 dias), exportacao dos dados de um espaco e
--   inativar/reativar espaco. Tudo com motivo e registro no painel e na
--   Auditoria do espaco; o papel do painel nunca le tabela de aluno direto.
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform.privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text REFERENCES public.organizations(id) ON DELETE SET NULL,
  requester_name text NOT NULL CHECK (length(trim(requester_name)) BETWEEN 2 AND 120),
  requester_email text NOT NULL CHECK (requester_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  kind text NOT NULL CHECK (kind IN ('access', 'correction', 'deletion', 'portability', 'revoke_consent', 'other')),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 3 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'rejected')),
  received_at timestamptz NOT NULL DEFAULT now(),
  -- Prazo de resposta ao titular: 15 dias (LGPD, art. 19, II).
  due_at timestamptz NOT NULL DEFAULT (now() + interval '15 days'),
  resolution text,
  created_by_name text,
  handled_by_name text,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_open ON platform.privacy_requests (due_at) WHERE status IN ('open', 'in_progress');

ALTER TABLE platform.privacy_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY privacy_requests_platform_app ON platform.privacy_requests FOR ALL TO platform_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON platform.privacy_requests TO platform_app;

-- Inativar / reativar espaco (reversivel). Inativo: ninguem do espaco entra e as
-- rotinas diarias pulam o espaco. Nada e apagado.
CREATE OR REPLACE FUNCTION platform.set_space_status(
  p_org text, p_status text, p_reason text, p_admin uuid, p_admin_name text, p_ip text, p_ua text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
DECLARE
  v_before text;
  v_label text := 'Suporte do GestaraHub';
BEGIN
  IF p_status NOT IN ('active', 'inactive') THEN RAISE EXCEPTION 'Situação inválida.' USING ERRCODE = '22023'; END IF;
  IF length(trim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Diga o motivo.' USING ERRCODE = '22023'; END IF;
  SELECT status INTO v_before FROM public.organizations WHERE id = p_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Espaço não encontrado.' USING ERRCODE = 'P0002'; END IF;
  IF v_before = p_status THEN
    RAISE EXCEPTION '%', CASE p_status WHEN 'inactive' THEN 'O espaço já está inativo.' ELSE 'O espaço já está ativo.' END USING ERRCODE = '22023';
  END IF;
  UPDATE public.organizations SET status = p_status WHERE id = p_org;
  INSERT INTO public.audit_logs (id, organization_id, actor, action, target, summary, changes, security, source)
  VALUES (gen_random_uuid(), p_org,
          jsonb_build_object('kind', 'system', 'userId', 'platform', 'name', v_label, 'profile', 'owner'),
          'updated', jsonb_build_object('type', 'space', 'id', p_org, 'label', 'Situação do espaço'),
          v_label || CASE p_status WHEN 'inactive' THEN ' inativou o espaço' ELSE ' reativou o espaço' END, NULL, true, 'platform');
  INSERT INTO platform.audit_logs (admin_id, admin_name, action, organization_id, target, reason, before, after, ip, user_agent)
  VALUES (p_admin, p_admin_name, CASE p_status WHEN 'inactive' THEN 'space.inactivate' ELSE 'space.reactivate' END, p_org,
          '{}'::jsonb, p_reason, jsonb_build_object('status', v_before), jsonb_build_object('status', p_status), p_ip, p_ua);
END $$;

-- Exportacao dos dados de um espaco (acesso/portabilidade do titular): so as
-- tabelas do cadastro e da operacao, sem token, segredo, hash nem chave.
CREATE OR REPLACE FUNCTION platform.export_space(
  p_org text, p_reason text, p_admin uuid, p_admin_name text, p_ip text, p_ua text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
DECLARE
  v_tables text[] := ARRAY[
    'units', 'users', 'roles', 'professionals', 'clients', 'categories', 'class_groups', 'enrollments',
    'attendances', 'class_reservations', 'class_session_overrides', 'waitlist', 'assessments', 'attachments',
    'plans', 'lesson_packages', 'student_packages', 'charges', 'online_payments', 'financial_categories',
    'financial_entries', 'financial_recurrences', 'teacher_pay_rules', 'teacher_payouts', 'message_templates',
    'message_logs', 'legal_consents', 'subscription_events', 'audit_logs'
  ];
  v_table text;
  v_rows jsonb;
  v_result jsonb;
  v_label text := 'Suporte do GestaraHub';
  v_org jsonb;
BEGIN
  IF length(trim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Diga o motivo da exportação.' USING ERRCODE = '22023'; END IF;
  SELECT to_jsonb(o) - 'gateway_api_key' - 'gateway_wallet_id' - 'gateway_account_id' INTO v_org FROM public.organizations o WHERE o.id = p_org;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Espaço não encontrado.' USING ERRCODE = 'P0002'; END IF;
  v_result := jsonb_build_object('exportedAt', now(), 'organization', v_org);
  FOREACH v_table IN ARRAY v_tables LOOP
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
       WHERE c.table_schema = 'public' AND c.table_name = v_table AND c.column_name = 'organization_id');
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM public.%I t WHERE t.organization_id = $1', v_table)
      INTO v_rows USING p_org;
    -- Tira qualquer campo que pareca segredo, mesmo dentro das linhas.
    SELECT coalesce(jsonb_agg(
             (SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) FROM jsonb_each(row_) AS e(k, v)
               WHERE k !~* '(token|secret|hash|api_key|password|wallet|totp)')), '[]'::jsonb)
      INTO v_rows FROM jsonb_array_elements(v_rows) AS r(row_);
    v_result := v_result || jsonb_build_object(v_table, v_rows);
  END LOOP;
  INSERT INTO public.audit_logs (id, organization_id, actor, action, target, summary, changes, security, source)
  VALUES (gen_random_uuid(), p_org,
          jsonb_build_object('kind', 'system', 'userId', 'platform', 'name', v_label, 'profile', 'owner'),
          'updated', jsonb_build_object('type', 'space', 'id', p_org, 'label', 'Exportação dos dados do espaço'),
          v_label || ' exportou os dados do espaço', NULL, true, 'platform');
  INSERT INTO platform.audit_logs (admin_id, admin_name, action, organization_id, target, reason, ip, user_agent)
  VALUES (p_admin, p_admin_name, 'space.data_export', p_org, '{}'::jsonb, p_reason, p_ip, p_ua);
  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION platform.set_space_status(text, text, text, uuid, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION platform.export_space(text, text, uuid, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION platform.set_space_status(text, text, text, uuid, text, text, text) TO platform_app;
GRANT EXECUTE ON FUNCTION platform.export_space(text, text, uuid, text, text, text) TO platform_app;
