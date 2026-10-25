-- =============================================================================
-- Migration: 20261025000064_error_occurrences.sql
-- Description: Historico das ultimas ocorrencias de cada erro (doc technical/21).
--   `error_logs` guarda uma linha por erro e a ultima ocorrencia sobrescreve a
--   anterior: o codigo que o cliente viu ("Relatar problema") deixava de achar
--   o erro quando ele se repetia. Agora cada ocorrencia fica com o seu codigo,
--   o contexto da hora (tela, perfil, plano, versao, tempo) e a mensagem, as 20
--   mais recentes por erro. Mesma mascara do erro; some junto com ele.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.error_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_id uuid NOT NULL REFERENCES public.error_logs(id) ON DELETE CASCADE,
  -- Codigo mostrado ao usuario naquela ocorrencia.
  reference text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  message text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id text
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_error_occurrences_reference ON public.error_occurrences (reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_error_occurrences_error ON public.error_occurrences (error_id, occurred_at DESC);

ALTER TABLE public.error_occurrences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.error_occurrences FROM anon, authenticated;
CREATE POLICY error_occurrences_platform_app_select ON public.error_occurrences FOR SELECT TO platform_app USING (true);
GRANT SELECT ON public.error_occurrences TO platform_app;

-- Os erros que ja existem: a ultima ocorrencia de cada um vira a primeira do historico.
INSERT INTO public.error_occurrences (error_id, reference, occurred_at, message, context, user_id)
SELECT id, last_reference, last_seen, left(message, 500), context, last_user_id
  FROM public.error_logs
 WHERE last_reference IS NOT NULL
ON CONFLICT DO NOTHING;

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

  -- So as 20 mais recentes de cada erro.
  DELETE FROM public.error_occurrences
   WHERE error_id = v_id
     AND id NOT IN (SELECT id FROM public.error_occurrences WHERE error_id = v_id ORDER BY occurred_at DESC, id DESC LIMIT 20);
END;
$$;

REVOKE ALL ON FUNCTION public.record_error(text, text, text, text, text, text, text, jsonb, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_error(text, text, text, text, text, text, text, jsonb, text, text) TO service_role;
