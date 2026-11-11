-- =============================================================================
-- Migration: 20261110000095_error_new_fingerprint.sql
-- Description: Alerta imediato de erro nunca visto (doc technical/27).
--   record_error passa a devolver se a impressao digital do erro e nova em todo
--   o sistema (nenhum espaco teve esse erro antes). O servidor manda um e-mail
--   na hora so nesse caso; o resumo diario continua igual.
-- =============================================================================

CREATE INDEX IF NOT EXISTS error_logs_fingerprint_idx ON public.error_logs (fingerprint);

DROP FUNCTION IF EXISTS public.record_error(text, text, text, text, text, text, text, jsonb, text, text);

CREATE FUNCTION public.record_error(
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
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_new boolean;
BEGIN
  v_new := NOT EXISTS (SELECT 1 FROM public.error_logs WHERE fingerprint = p_fingerprint);

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

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.record_error(text, text, text, text, text, text, text, jsonb, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_error(text, text, text, text, text, text, text, jsonb, text, text) TO service_role;
