-- =============================================================================
-- Migration: 20261024000061_help_events.sql
-- Description: Uso da ajuda do app (doc technical/26, 18.2): termo buscado sem
--   resultado (`miss`) e "isso ajudou?" por trecho (`helpful`, `not_helpful`).
--   Serve para saber que artigo escrever ou melhorar. Sem dado pessoal: o
--   servidor mascara o termo e guarda so o espaco (para contar espacos
--   diferentes), nunca a pessoa. Mora no schema `platform`; o app dos clientes
--   entra so pela funcao abaixo, com a chave de servico.
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform.help_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('miss', 'helpful', 'not_helpful')),
  -- miss: o que a pessoa buscou (mascarado); feedback: vazio.
  term text,
  -- Trecho avaliado (id do indice, ex.: alunos#cadastrar-um-aluno); vazio em miss.
  chunk_id text,
  route text,
  organization_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT help_events_shape CHECK (
    (kind = 'miss' AND term IS NOT NULL AND chunk_id IS NULL)
    OR (kind <> 'miss' AND chunk_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_help_events_kind_created ON platform.help_events (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_help_events_chunk ON platform.help_events (chunk_id) WHERE chunk_id IS NOT NULL;

ALTER TABLE platform.help_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY help_events_platform_app ON platform.help_events FOR SELECT TO platform_app USING (true);
GRANT SELECT ON platform.help_events TO platform_app;

CREATE OR REPLACE FUNCTION public.help_log_event(p_kind text, p_term text, p_chunk text, p_route text, p_org text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
BEGIN
  IF p_kind NOT IN ('miss', 'helpful', 'not_helpful') THEN
    RAISE EXCEPTION 'Tipo inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'miss' THEN
    IF length(trim(coalesce(p_term, ''))) < 2 THEN RAISE EXCEPTION 'Termo vazio.' USING ERRCODE = '22023'; END IF;
    INSERT INTO platform.help_events (kind, term, route, organization_id)
    VALUES ('miss', left(lower(trim(p_term)), 120), nullif(left(p_route, 200), ''), p_org);
  ELSE
    IF length(trim(coalesce(p_chunk, ''))) = 0 THEN RAISE EXCEPTION 'Trecho vazio.' USING ERRCODE = '22023'; END IF;
    INSERT INTO platform.help_events (kind, chunk_id, route, organization_id)
    VALUES (p_kind, left(trim(p_chunk), 120), nullif(left(p_route, 200), ''), p_org);
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.help_log_event(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.help_log_event(text, text, text, text, text) TO service_role;
