-- =============================================================================
-- Migration: 20261105000088_access_email_switch.sql
-- Description: Troca do e-mail de acesso, parte 2 (05/11/2026, doc technical/17).
--   1. public.use_email_login: depois da troca, a conta entra so pelo e-mail
--      novo. Tira os logins de outros provedores (o Google antigo), cria ou
--      atualiza a identidade de e-mail e encerra as sessoes abertas. Se o e-mail
--      novo for de uma conta Google, entrar com o Google liga de novo sozinho.
--   2. platform.change_user_access_email: o painel troca o e-mail de quem
--      perdeu o acesso (ex.: perdeu o Gmail), com motivo, depois de confirmar
--      quem e por fora do sistema. Grava o link de criar senha (so o hash) e
--      registra na Auditoria do espaco e do painel.
--   3. Codigo por e-mail com o proposito 'email_change' (quem entra pelo Google
--      prova que e ele com um codigo no Gmail atual).
-- =============================================================================

alter table public.two_factor_email_codes drop constraint if exists two_factor_email_codes_purpose_check;
alter table public.two_factor_email_codes
  add constraint two_factor_email_codes_purpose_check
  check (purpose in ('login', 'enable', 'disable', 'recovery', 'email_change'));

-- E-mail de acesso de outra conta (login ou convite em aberto, em qualquer espaco).
CREATE OR REPLACE FUNCTION public.access_email_in_use(p_auth uuid, p_email text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (
           SELECT 1 FROM public.users u
            WHERE lower(u.email) = lower(trim(p_email))
              AND u.auth_user_id IS DISTINCT FROM p_auth)
      OR EXISTS (
           SELECT 1 FROM auth.users a
            WHERE lower(a.email) = lower(trim(p_email))
              AND a.id <> p_auth)
$$;

CREATE OR REPLACE FUNCTION public.use_email_login(p_auth uuid, p_email text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_email text := lower(trim(p_email));
BEGIN
  DELETE FROM auth.identities WHERE user_id = p_auth AND provider <> 'email';
  UPDATE auth.identities
     SET identity_data = identity_data || jsonb_build_object('email', v_email, 'email_verified', true),
         updated_at = now()
   WHERE user_id = p_auth AND provider = 'email';
  IF NOT FOUND THEN
    INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
    VALUES (p_auth::text, p_auth,
            jsonb_build_object('sub', p_auth::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
            'email', now(), now());
  END IF;
  UPDATE auth.users
     SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
         updated_at = now()
   WHERE id = p_auth;
  -- Sai de todos os aparelhos: entra de novo com o e-mail novo.
  DELETE FROM auth.sessions WHERE user_id = p_auth;
  DELETE FROM public.trusted_devices WHERE auth_user_id = p_auth;
  DELETE FROM public.two_factor_sessions WHERE auth_user_id = p_auth;
END $$;

-- Painel: troca o e-mail de acesso de uma pessoa do espaco.
CREATE OR REPLACE FUNCTION platform.change_user_access_email(
  p_org text, p_user text, p_new_email text, p_reason text, p_token_hash text,
  p_admin uuid, p_admin_name text, p_ip text, p_ua text
) RETURNS TABLE (name text, old_email text, new_email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform, auth AS $$
DECLARE
  v_auth uuid;
  v_name text;
  v_profile text;
  v_old text;
  v_new text := lower(trim(coalesce(p_new_email, '')));
  v_label text := 'Suporte do GestaraHub';
BEGIN
  IF length(trim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Diga o motivo.' USING ERRCODE = '22023'; END IF;
  IF v_new !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RAISE EXCEPTION 'Informe um e-mail válido.' USING ERRCODE = '22023'; END IF;
  SELECT u.auth_user_id, u.name, u.profile, lower(u.email) INTO v_auth, v_name, v_profile, v_old
    FROM public.users u WHERE u.id = p_user AND u.organization_id = p_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pessoa não encontrada neste espaço.' USING ERRCODE = 'P0002'; END IF;
  IF v_auth IS NULL THEN RAISE EXCEPTION 'Esta pessoa ainda não tem login (convite não aceito).' USING ERRCODE = '22023'; END IF;
  IF v_new = v_old THEN RAISE EXCEPTION 'Este já é o e-mail de acesso.' USING ERRCODE = '22023'; END IF;
  IF public.access_email_in_use(v_auth, v_new) THEN
    RAISE EXCEPTION 'Este e-mail já é usado por outra conta.' USING ERRCODE = '23505';
  END IF;

  UPDATE auth.users
     SET email = v_new, email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
   WHERE id = v_auth;
  PERFORM public.use_email_login(v_auth, v_new);
  UPDATE public.users SET email = v_new WHERE auth_user_id = v_auth;
  DELETE FROM public.email_change_tokens WHERE auth_user_id = v_auth AND status = 'pending';

  -- Link de criar senha no app (o mesmo de "Esqueci minha senha"), por 24 horas.
  UPDATE public.password_reset_tokens SET status = 'revoked' WHERE auth_user_id = v_auth AND status = 'pending';
  INSERT INTO public.password_reset_tokens (auth_user_id, email, token_hash, expires_at)
  VALUES (v_auth, v_new, p_token_hash, now() + interval '24 hours');

  INSERT INTO public.audit_logs (id, organization_id, actor, action, target, summary, changes, security, source)
  VALUES (gen_random_uuid(), p_org,
          jsonb_build_object('kind', 'system', 'userId', 'platform', 'name', v_label, 'profile', 'owner'),
          'updated', jsonb_build_object('type', 'user', 'id', p_user, 'label', v_name, 'profile', v_profile),
          v_label || ' trocou o e-mail de acesso de ' || v_name, NULL, true, 'platform');
  INSERT INTO platform.audit_logs (admin_id, admin_name, action, organization_id, target, reason, ip, user_agent)
  VALUES (p_admin, p_admin_name, 'space.user_access_email', p_org,
          jsonb_build_object('userId', p_user, 'profile', v_profile), p_reason, p_ip, p_ua);

  RETURN QUERY SELECT v_name, v_old, v_new;
END $$;

REVOKE ALL ON FUNCTION public.access_email_in_use(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.use_email_login(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.access_email_in_use(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.use_email_login(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION platform.change_user_access_email(text, text, text, text, text, uuid, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION platform.change_user_access_email(text, text, text, text, text, uuid, text, text, text)
  TO platform_app;
