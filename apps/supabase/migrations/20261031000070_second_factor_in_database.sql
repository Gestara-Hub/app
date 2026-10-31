-- =============================================================================
-- Migration: 20261031000070_second_factor_in_database.sql
-- Description: a verificacao em duas etapas valia so no app (requireTenant e
--   getClientForTenant, doc technical/17). Com a senha, o login ja grava a
--   sessao do Supabase (AAL1) antes do codigo, e o token dela, chamando o
--   PostgREST direto, lia alunos (CPF, menores, responsaveis) sem o segundo
--   fator. Auditoria de 30/10/2026.
--   second_factor_ok(): a sessao passou pela verificacao, ou a pessoa nao a
--   ligou. Passou = AAL2 (aplicativo) ou prova valida em two_factor_sessions
--   (codigo por e-mail, dispositivo lembrado ou codigo de recuperacao), a
--   mesma regra de `secondFactorInfo` (lib/security/second-factor.ts).
--   Politica restritiva em todas as tabelas com RLS e nos arquivos: sem o
--   segundo fator, o banco nao entrega nem grava nada para `authenticated`.
--   O servidor (chave de servico) nao passa por RLS e segue igual.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.second_factor_ok()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT
    coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    OR (
      NOT EXISTS (
        SELECT 1 FROM auth.mfa_factors f
        WHERE f.user_id = auth.uid() AND f.status = 'verified'
      )
      AND coalesce(
        (SELECT (u.raw_app_meta_data ->> 'two_factor_email')::boolean FROM auth.users u WHERE u.id = auth.uid()),
        false
      ) = false
    )
    OR EXISTS (
      SELECT 1 FROM public.two_factor_sessions s
      WHERE s.auth_user_id = auth.uid()
        AND s.session_id::text = auth.jwt() ->> 'session_id'
        AND s.expires_at > now()
    );
$$;

REVOKE ALL ON FUNCTION public.second_factor_ok() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.second_factor_ok() TO authenticated, service_role;

-- Restritiva: soma-se as politicas de cada tabela (todas precisam passar).
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS require_second_factor ON public.%I', t.relname);
    EXECUTE format(
      'CREATE POLICY require_second_factor ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING ((SELECT public.second_factor_ok())) WITH CHECK ((SELECT public.second_factor_ok()))',
      t.relname
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS require_second_factor ON storage.objects;
CREATE POLICY require_second_factor ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.second_factor_ok())) WITH CHECK ((SELECT public.second_factor_ok()));
