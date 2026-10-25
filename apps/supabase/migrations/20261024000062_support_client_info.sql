-- =============================================================================
-- Migration: 20261024000062_support_client_info.sql
-- Description: Contexto tecnico da conversa de problema (navegador, sistema,
--   perfil e versao do app), gravado sozinho para a equipe reproduzir o erro.
--   Texto curto montado no servidor; sem dado da pessoa alem do perfil.
-- =============================================================================

ALTER TABLE platform.support_threads ADD COLUMN IF NOT EXISTS client_info text;

DROP FUNCTION IF EXISTS public.support_open_thread(text, text, text, text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.support_open_thread(
  p_org text, p_user text, p_name text, p_email text, p_phone text,
  p_subject text, p_first_message text, p_origin text, p_error_ref text, p_tier text,
  p_kind text DEFAULT 'question', p_client_info text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
DECLARE v_id uuid;
BEGIN
  IF length(trim(coalesce(p_first_message, ''))) = 0 THEN
    RAISE EXCEPTION 'Escreva a mensagem.' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_kind, 'question') NOT IN ('question', 'bug', 'suggestion') THEN
    RAISE EXCEPTION 'Tipo de conversa inválido.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO platform.support_threads (organization_id, user_id, user_name, user_email, user_phone, subject,
                                         origin_screen, error_reference, plan_tier, last_customer_message_at, kind, client_info)
  VALUES (p_org, p_user, p_name, p_email, nullif(p_phone, ''), left(trim(p_subject), 120),
          nullif(left(p_origin, 200), ''), nullif(left(p_error_ref, 40), ''), p_tier, now(), coalesce(p_kind, 'question'),
          nullif(left(trim(coalesce(p_client_info, '')), 300), ''))
  RETURNING id INTO v_id;
  INSERT INTO platform.support_messages (thread_id, author, body) VALUES (v_id, 'customer', left(p_first_message, 4000));
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.support_open_thread(text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_open_thread(text, text, text, text, text, text, text, text, text, text, text, text) TO service_role;
