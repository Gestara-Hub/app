-- =============================================================================
-- Migration: 20261025000065_bug_tracking.sql
-- Description: Rastrear no painel um erro ou problema relatado (doc technical/21 e 26).
--   1. A limpeza das ocorrencias de erro (20 por erro) nunca apaga uma ocorrencia
--      cujo codigo esta numa conversa de suporte: e a que a pessoa reportou.
--   2. O encaminhamento ao suporte devolve a tela e o codigo do erro da conversa,
--      para o aviso por e-mail da equipe dizer o que aconteceu.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_error(
  p_organization_id text,
  p_fingerprint text,
  p_source text,
  p_level text,
  p_event text,
  p_message text,
  p_stack text,
  p_context jsonb,
  p_reference text,
  p_user_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.error_logs AS e (
    organization_id, fingerprint, source, level, event, message, stack, context, last_reference, last_user_id
  )
  -- Espaco que nao existe (apagado no meio) grava sem espaco em vez de falhar.
  SELECT CASE WHEN EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p_organization_id) THEN p_organization_id END,
         p_fingerprint, p_source, p_level, left(p_event, 200), left(p_message, 2000), left(p_stack, 8000),
         coalesce(p_context, '{}'::jsonb), p_reference, p_user_id
  ON CONFLICT ((coalesce(organization_id, '')), fingerprint) DO UPDATE SET
    count = e.count + 1,
    last_seen = now(),
    level = excluded.level,
    message = excluded.message,
    stack = coalesce(excluded.stack, e.stack),
    context = excluded.context,
    last_reference = excluded.last_reference,
    last_user_id = coalesce(excluded.last_user_id, e.last_user_id)
  RETURNING e.id INTO v_id;

  INSERT INTO public.error_occurrences (error_id, reference, message, context, user_id)
  VALUES (v_id, p_reference, left(p_message, 500), coalesce(p_context, '{}'::jsonb), p_user_id)
  ON CONFLICT DO NOTHING;

  -- So as 20 mais recentes de cada erro, mas nunca a que uma conversa de suporte aponta.
  DELETE FROM public.error_occurrences oc
   WHERE oc.error_id = v_id
     AND oc.id NOT IN (SELECT id FROM public.error_occurrences WHERE error_id = v_id ORDER BY occurred_at DESC, id DESC LIMIT 20)
     AND NOT EXISTS (SELECT 1 FROM platform.support_threads t WHERE t.error_reference = oc.reference);
END;
$$;

REVOKE ALL ON FUNCTION public.record_error(text, text, text, text, text, text, text, jsonb, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_error(text, text, text, text, text, text, text, jsonb, text, text) TO service_role;

DROP FUNCTION IF EXISTS public.support_escalate(text, text, uuid, text, boolean);

CREATE OR REPLACE FUNCTION public.support_escalate(p_org text, p_user text, p_thread uuid, p_summary text, p_urgent boolean)
RETURNS TABLE (subject text, user_name text, user_email text, organization_name text, urgent boolean, kind text, number integer,
               origin_screen text, error_reference text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
DECLARE v_kind text; v_number integer;
BEGIN
  UPDATE platform.support_threads t SET
    status = 'waiting_us', urgent = coalesce(p_urgent, false), summary = left(nullif(trim(p_summary), ''), 600),
    escalated_at = coalesce(t.escalated_at, now()), last_message_at = now(), customer_seen_at = now()
  WHERE t.id = p_thread AND t.organization_id = p_org AND t.user_id = p_user AND t.status IN ('bot', 'waiting_customer', 'resolved')
  RETURNING t.kind, t.number INTO v_kind, v_number;
  IF NOT FOUND THEN
    -- Ja estava com o suporte (ou nao e da pessoa): nada a mudar.
    RETURN;
  END IF;
  INSERT INTO platform.support_messages (thread_id, author, body)
  VALUES (p_thread, 'system', CASE v_kind
    WHEN 'bug' THEN 'Recebemos seu relato (protocolo GH-' || v_number || '). Obrigado por nos ajudar a melhorar o GestaraHub. Se precisarmos de mais detalhes, escrevemos por aqui e por e-mail.'
    WHEN 'suggestion' THEN 'Recebemos sua sugestão (protocolo GH-' || v_number || '). Obrigado por nos ajudar a melhorar o GestaraHub. Lemos todas e, se precisarmos de mais detalhes, escrevemos por aqui e por e-mail.'
    ELSE 'Enviamos sua conversa para o suporte (protocolo GH-' || v_number || '). Respondemos em até 2 dias úteis, por aqui e por e-mail.' END);
  RETURN QUERY SELECT t.subject, t.user_name, t.user_email, o.name, t.urgent, t.kind, t.number, t.origin_screen, t.error_reference
    FROM platform.support_threads t JOIN public.organizations o ON o.id = t.organization_id WHERE t.id = p_thread;
END $$;

REVOKE ALL ON FUNCTION public.support_escalate(text, text, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_escalate(text, text, uuid, text, boolean) TO service_role;
