-- =============================================================================
-- Migration: 20261024000059_platform_user_two_factor.sql
-- Description: Reiniciar a verificacao em duas etapas de um usuario de espaco
--   pelo painel (doc technical/26 e technical/17). O painel nao le public.users
--   nem auth direto: so estas duas funcoes. Registram na Auditoria do espaco
--   (o dono ve) e na do painel, com motivo. A parte do Auth (remover o app,
--   desligar o e-mail) o painel faz pela API de administracao, antes de chamar
--   a segunda funcao.
-- =============================================================================

-- Pessoas do espaco e como estao no 2FA (sem dados de aluno: so a equipe do espaco).
CREATE OR REPLACE FUNCTION platform.list_space_users(p_org text)
RETURNS TABLE (user_id text, auth_user_id uuid, name text, email text, profile text, status text, two_factor_app boolean, two_factor_email boolean, recovery_codes_left integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, platform AS $$
  SELECT u.id, u.auth_user_id, u.name, u.email, u.profile, u.status,
         EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = u.auth_user_id AND f.factor_type = 'totp' AND f.status = 'verified'),
         coalesce((SELECT (a.raw_app_meta_data->>'two_factor_email')::boolean FROM auth.users a WHERE a.id = u.auth_user_id), false),
         (SELECT count(*)::int FROM public.two_factor_recovery_codes c WHERE c.auth_user_id = u.auth_user_id AND c.used_at IS NULL)
    FROM public.users u
   WHERE u.organization_id = p_org
   ORDER BY u.profile, u.name
$$;

-- Fecha o reinicio: limpa o que e nosso (dispositivos lembrados, sessoes verificadas,
-- codigos de recuperacao) e registra nos dois lugares.
CREATE OR REPLACE FUNCTION platform.finish_user_two_factor_reset(
  p_org text, p_user text, p_reason text, p_admin uuid, p_admin_name text, p_ip text, p_ua text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
DECLARE
  v_auth uuid;
  v_name text;
  v_profile text;
  v_label text := 'Suporte do GestaraHub';
BEGIN
  IF length(trim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Diga o motivo.' USING ERRCODE = '22023'; END IF;
  SELECT auth_user_id, name, profile INTO v_auth, v_name, v_profile FROM public.users WHERE id = p_user AND organization_id = p_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pessoa não encontrada neste espaço.' USING ERRCODE = 'P0002'; END IF;
  IF v_auth IS NOT NULL THEN
    DELETE FROM public.trusted_devices WHERE auth_user_id = v_auth;
    DELETE FROM public.two_factor_sessions WHERE auth_user_id = v_auth;
    DELETE FROM public.two_factor_recovery_codes WHERE auth_user_id = v_auth;
    DELETE FROM public.two_factor_email_codes WHERE auth_user_id = v_auth;
  END IF;
  INSERT INTO public.audit_logs (id, organization_id, actor, action, target, summary, changes, security, source)
  VALUES (gen_random_uuid(), p_org,
          jsonb_build_object('kind', 'system', 'userId', 'platform', 'name', v_label, 'profile', 'owner'),
          'updated', jsonb_build_object('type', 'user', 'id', p_user, 'label', v_name, 'profile', v_profile),
          v_label || ' reiniciou a verificação em duas etapas de ' || v_name, NULL, true, 'platform');
  INSERT INTO platform.audit_logs (admin_id, admin_name, action, organization_id, target, reason, ip, user_agent)
  VALUES (p_admin, p_admin_name, 'space.user_two_factor_reset', p_org, jsonb_build_object('userId', p_user, 'profile', v_profile), p_reason, p_ip, p_ua);
END $$;

REVOKE ALL ON FUNCTION platform.list_space_users(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION platform.finish_user_two_factor_reset(text, text, text, uuid, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION platform.list_space_users(text) TO platform_app;
GRANT EXECUTE ON FUNCTION platform.finish_user_two_factor_reset(text, text, text, uuid, text, text, text) TO platform_app;
