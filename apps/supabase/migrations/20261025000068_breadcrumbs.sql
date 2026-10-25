-- =============================================================================
-- Migration: 20261025000068_breadcrumbs.sql
-- Description: Rastro do que a pessoa fez antes de um erro ou relato (doc technical/21).
--   O navegador guarda os ultimos passos (telas abertas e nomes das acoes, com
--   erro ou sem, nunca texto digitado nem nome de aluno) e os envia em dois casos:
--   1. Relato de problema: `support_threads.breadcrumbs` (jsonb, ate 20 passos).
--   2. Erro de acao do servidor: o servidor ja gravou a ocorrencia; o navegador
--      completa o contexto dela com os passos (`error_attach_breadcrumbs`), so
--      se a ocorrencia e da mesma pessoa e ainda nao tem passos.
--   Erro do navegador manda os passos junto, no proprio contexto.
-- =============================================================================

ALTER TABLE platform.support_threads ADD COLUMN IF NOT EXISTS breadcrumbs jsonb;

DROP FUNCTION IF EXISTS public.support_open_thread(text, text, text, text, text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.support_open_thread(
  p_org text, p_user text, p_name text, p_email text, p_phone text,
  p_subject text, p_first_message text, p_origin text, p_error_ref text, p_tier text,
  p_kind text DEFAULT 'question', p_client_info text DEFAULT NULL, p_breadcrumbs jsonb DEFAULT NULL
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
                                         origin_screen, error_reference, plan_tier, last_customer_message_at, kind, client_info, breadcrumbs)
  VALUES (p_org, p_user, p_name, p_email, nullif(p_phone, ''), left(trim(p_subject), 120),
          nullif(left(p_origin, 200), ''), nullif(left(p_error_ref, 40), ''), p_tier, now(), coalesce(p_kind, 'question'),
          nullif(left(trim(coalesce(p_client_info, '')), 300), ''),
          CASE WHEN jsonb_typeof(p_breadcrumbs) = 'array' AND jsonb_array_length(p_breadcrumbs) BETWEEN 1 AND 20 THEN p_breadcrumbs END)
  RETURNING id INTO v_id;
  INSERT INTO platform.support_messages (thread_id, author, body) VALUES (v_id, 'customer', left(p_first_message, 4000));
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.support_open_thread(text, text, text, text, text, text, text, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_open_thread(text, text, text, text, text, text, text, text, text, text, text, text, jsonb) TO service_role;

-- Completa a ocorrencia de um erro com os passos que o navegador viu. Devolve
-- verdadeiro se gravou. So a mesma pessoa e o mesmo espaco, e so uma vez.
CREATE OR REPLACE FUNCTION public.error_attach_breadcrumbs(p_reference text, p_org text, p_user text, p_breadcrumbs jsonb)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF jsonb_typeof(p_breadcrumbs) <> 'array' OR jsonb_array_length(p_breadcrumbs) NOT BETWEEN 1 AND 20 THEN
    RETURN false;
  END IF;
  UPDATE public.error_occurrences oc
     SET context = oc.context || jsonb_build_object('breadcrumbs', p_breadcrumbs)
    FROM public.error_logs e
   WHERE oc.reference = p_reference
     AND oc.user_id = p_user
     AND e.id = oc.error_id
     AND e.organization_id = p_org
     AND NOT (oc.context ? 'breadcrumbs');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END $$;

REVOKE ALL ON FUNCTION public.error_attach_breadcrumbs(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.error_attach_breadcrumbs(text, text, text, jsonb) TO service_role;
