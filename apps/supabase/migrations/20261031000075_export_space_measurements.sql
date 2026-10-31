-- =============================================================================
-- Migration: 20261031000075_export_space_measurements.sql
-- Description: a exportacao dos dados de um espaco (acesso e portabilidade do
--   titular, LGPD) passa a levar os testes e medidas dos alunos
--   (student_measurements, migracao 73). O resto da funcao e a mesma da
--   migracao 55; as permissoes dela seguem (CREATE OR REPLACE nao as muda).
-- =============================================================================

CREATE OR REPLACE FUNCTION platform.export_space(
  p_org text, p_reason text, p_admin uuid, p_admin_name text, p_ip text, p_ua text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
DECLARE
  v_tables text[] := ARRAY[
    'units', 'users', 'roles', 'professionals', 'clients', 'categories', 'class_groups', 'enrollments',
    'attendances', 'class_reservations', 'class_session_overrides', 'waitlist', 'assessments',
    'student_measurements', 'attachments',
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
