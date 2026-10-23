-- =============================================================================
-- Migration: 20261023000043_rls_initplan_and_bucket_cleanup.sql
-- Description: Doc 19, fase 3.
--   1. RLS: `current_organization_id()` e `current_user_profile()` passam a ser
--      chamadas como `(select ...)`. Assim o Postgres calcula uma vez por
--      consulta (InitPlan) em vez de uma vez por linha nas leituras feitas com
--      a sessao do usuario. A regra de cada politica nao muda: o texto e o
--      mesmo, so com as chamadas embrulhadas.
--   2. world_buckets (migracao 42) ganha updated_at e uma limpeza diaria: um
--      balde so importa enquanto alguma acao leu e ainda nao gravou (segundos;
--      no maximo os 5 minutos de uma rota). Sem mudanca ha mais de um dia,
--      apagar equivale a "nao mudou desde sempre", o que nenhuma acao em
--      andamento pode ter lido. A tabela fica com o que mudou nas ultimas 24 h.
-- =============================================================================

-- 1. Politicas com as funcoes de sessao embrulhadas -----------------------------
DO $$
DECLARE
  v_policy record;
  v_using text;
  v_check text;
  v_sql text;
BEGIN
  FOR v_policy IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual, '') || coalesce(with_check, '')) ~ '(current_organization_id|current_user_profile)\(\)'
      -- Ja embrulhada (rodar de novo nao embrulha duas vezes).
      AND (coalesce(qual, '') || coalesce(with_check, '')) !~* 'select current_(organization_id|user_profile)'
  LOOP
    v_using := regexp_replace(v_policy.qual, '(current_organization_id|current_user_profile)\(\)', '(SELECT \1())', 'g');
    v_check := regexp_replace(v_policy.with_check, '(current_organization_id|current_user_profile)\(\)', '(SELECT \1())', 'g');
    v_sql := format('ALTER POLICY %I ON public.%I', v_policy.policyname, v_policy.tablename);
    IF v_using IS NOT NULL THEN
      v_sql := v_sql || format(' USING (%s)', v_using);
    END IF;
    IF v_check IS NOT NULL THEN
      v_sql := v_sql || format(' WITH CHECK (%s)', v_check);
    END IF;
    EXECUTE v_sql;
  END LOOP;
END;
$$;

-- 2. Limpeza diaria dos baldes --------------------------------------------------
ALTER TABLE public.world_buckets ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.touch_world_bucket()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS world_buckets_touch ON public.world_buckets;
CREATE TRIGGER world_buckets_touch BEFORE UPDATE ON public.world_buckets
  FOR EACH ROW EXECUTE FUNCTION public.touch_world_bucket();

CREATE INDEX IF NOT EXISTS idx_world_buckets_updated_at ON public.world_buckets (updated_at);

CREATE OR REPLACE FUNCTION public.prune_world_buckets()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH removed AS (
    DELETE FROM public.world_buckets WHERE updated_at < now() - interval '1 day' RETURNING 1
  )
  SELECT count(*) FROM removed;
$$;

REVOKE ALL ON FUNCTION public.prune_world_buckets() FROM public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

-- Todo dia as 03:30 de Brasilia (06:30 UTC), fora do horario de uso. Reagenda se ja existir.
select cron.unschedule(jobid) from cron.job where jobname = 'world-buckets-prune-daily';
select cron.schedule('world-buckets-prune-daily', '30 6 * * *', 'select public.prune_world_buckets()');
