-- =============================================================================
-- Migration: 20261023000047_error_logs.sql
-- Description: Registro de erros no nosso banco (doc technical/21), sem servico
--   externo. Um erro igual (mesma "impressao digital": evento, mensagem sem
--   numeros e ids, e o local) vira UMA linha por espaco, com contador, primeira
--   e ultima vez: um erro em laco nao gera milhares de linhas. O texto chega
--   mascarado do app (sem CPF, token, senha). So o servidor (chave de servico)
--   le e grava. Retencao: 120 dias sem acontecer de novo (limpeza diaria).
--   Toda linha tambem sai no log da Vercel: o banco e a copia pesquisavel, nao
--   a unica (se o erro for o proprio banco, a gravacao aqui falha).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Sem espaco: erro de rotina geral, pagina publica ou antes do login.
  organization_id text REFERENCES public.organizations(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  source text NOT NULL CHECK (source IN ('server', 'browser', 'cron', 'webhook')),
  level text NOT NULL DEFAULT 'error' CHECK (level IN ('error', 'warn')),
  -- Onde aconteceu: "turmas.markAttendance", "cron.daily", "browser.render"...
  event text NOT NULL,
  message text NOT NULL,
  stack text,
  -- Contexto da ultima ocorrencia (metodo, rota, tela), ja mascarado.
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  count integer NOT NULL DEFAULT 1,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  -- Codigo mostrado ao usuario na mensagem de erro (liga a queixa a linha).
  last_reference text,
  last_user_id text,
  -- Ja saiu no resumo diario por e-mail? (so os novos ou que voltaram entram)
  notified_at timestamptz
);

-- Uma linha por (espaco, impressao digital); erro sem espaco agrupa no vazio.
CREATE UNIQUE INDEX IF NOT EXISTS uq_error_logs_org_fingerprint
  ON public.error_logs ((coalesce(organization_id, '')), fingerprint);
CREATE INDEX IF NOT EXISTS idx_error_logs_last_seen ON public.error_logs (last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_org_last_seen ON public.error_logs (organization_id, last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_reference ON public.error_logs (last_reference);

-- So o servidor (chave de servico): sem politicas para a sessao.
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Grava ou soma uma ocorrencia (atomico: dois erros iguais ao mesmo tempo somam 2).
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
    last_user_id = coalesce(excluded.last_user_id, e.last_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_error(text, text, text, text, text, text, text, jsonb, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_error(text, text, text, text, text, text, text, jsonb, text, text) TO service_role;

-- Retencao: 120 dias sem acontecer de novo.
CREATE OR REPLACE FUNCTION public.prune_error_logs()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH removed AS (
    DELETE FROM public.error_logs WHERE last_seen < now() - interval '120 days' RETURNING 1
  )
  SELECT count(*) FROM removed;
$$;

REVOKE ALL ON FUNCTION public.prune_error_logs() FROM public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

-- Todo dia as 03:40 de Brasilia (06:40 UTC). Reagenda se ja existir.
select cron.unschedule(jobid) from cron.job where jobname = 'error-logs-prune-daily';
select cron.schedule('error-logs-prune-daily', '40 6 * * *', 'select public.prune_error_logs()');
