-- =============================================================================
-- Migration: 20261023000042_world_concurrency_by_read_set.sql
-- Description: Doc 19, fase 2: concorrencia pelo que a acao leu, nao pelo
--   espaco inteiro. Antes, toda gravacao exigia a mesma versao do espaco da
--   leitura: dois professores marcando chamada em turmas diferentes
--   conflitavam. Agora a acao com recorte manda os "baldes" (hash de colecao,
--   campo e valor, `services/world/scopes.ts`) que leu e os que grava; so
--   conflita se um balde lido foi marcado depois da leitura.
--   1. world_buckets: versao do espaco da ultima gravacao que marcou o balde.
--   2. world_versions.direct_version: versao da ultima gravacao direta (fora
--      do motor: webhook, rotinas). Gravacao direta nao sabe dos baldes, entao
--      conflita com toda acao com recorte lida antes dela (como antes).
--   3. apply_world_changes ganha p_read_buckets (NULL = espaco inteiro lido,
--      regra de antes) e p_write_buckets.
-- =============================================================================

ALTER TABLE public.world_versions ADD COLUMN IF NOT EXISTS direct_version bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.world_buckets (
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bucket integer NOT NULL,
  version bigint NOT NULL,
  PRIMARY KEY (organization_id, bucket)
);

-- So o servidor (chave de servico) le e grava.
ALTER TABLE public.world_buckets ENABLE ROW LEVEL SECURITY;

-- Gravacao direta: avanca a versao e marca direct_version (uma vez por transacao).
CREATE OR REPLACE FUNCTION public.bump_world_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_column constant text := TG_ARGV[0];
  v_orgs text[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    EXECUTE format('SELECT array_agg(DISTINCT %I::text) FROM old_rows', v_column) INTO v_orgs;
  ELSE
    EXECUTE format('SELECT array_agg(DISTINCT %I::text) FROM new_rows', v_column) INTO v_orgs;
  END IF;
  IF v_orgs IS NULL THEN
    RETURN NULL;
  END IF;

  -- Espaco que nunca gravou pelo motor (sem linha = versao 0): cria ja com 1,
  -- porque esta gravacao mudou o espaco. Na exclusao do espaco a linha sai em
  -- cascata; nao cria.
  IF TG_OP <> 'DELETE' THEN
    INSERT INTO public.world_versions (organization_id, version, direct_version)
      SELECT org, 1, 1 FROM unnest(v_orgs) AS org
      WHERE EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = org)
      ON CONFLICT DO NOTHING;
  END IF;

  -- apply_world_changes ja avancou nesta transacao (updated_at = now()): nao repete.
  UPDATE public.world_versions
    SET version = version + 1, direct_version = version + 1, updated_at = now()
    WHERE organization_id = ANY (v_orgs) AND updated_at <> now();
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_world_version() FROM PUBLIC;

DROP FUNCTION IF EXISTS public.apply_world_changes_returning(text, jsonb, bigint);
DROP FUNCTION IF EXISTS public.apply_world_changes(text, jsonb, bigint);

CREATE OR REPLACE FUNCTION public.apply_world_changes(
  p_organization_id text,
  p_changes jsonb,
  p_expected_version bigint,
  p_read_buckets integer[] DEFAULT NULL,
  p_write_buckets integer[] DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed constant text[] := ARRAY[
    'organizations', 'units', 'users', 'roles', 'categories', 'professionals', 'clients', 'plans',
    'lesson_packages', 'student_packages', 'charges', 'class_groups', 'enrollments', 'attendances',
    'waitlist', 'class_reservations', 'class_session_overrides', 'assessments', 'financial_categories',
    'financial_recurrences', 'financial_entries', 'teacher_pay_rules', 'teacher_payouts', 'online_payments',
    'whatsapp_connections', 'message_templates', 'message_logs', 'audit_logs'
  ];
  v_item jsonb;
  v_table text;
  v_pk text;
  v_row jsonb;
  v_cols text;
  v_set text;
  v_scope_col text;
  v_exists boolean;
  v_owner text;
  v_current timestamptz;
  v_version bigint;
  v_direct bigint;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'world: espaço ausente' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.world_versions (organization_id) VALUES (p_organization_id) ON CONFLICT DO NOTHING;
  IF p_read_buckets IS NULL THEN
    -- Espaco inteiro lido: qualquer gravacao depois da leitura conflita.
    UPDATE public.world_versions
      SET version = version + 1, updated_at = now()
      WHERE organization_id = p_organization_id AND version = p_expected_version
      RETURNING version INTO v_version;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'world: o espaço mudou depois da leitura' USING ERRCODE = '40001';
    END IF;
  ELSE
    -- Recorte lido: so conflita gravacao que marcou um balde lido depois da
    -- leitura, ou gravacao direta (fora do motor, sem baldes). O UPDATE trava a
    -- linha do espaco: as gravacoes seguem uma por vez, mas so as que mexem no
    -- que esta leu a fazem tentar de novo.
    UPDATE public.world_versions
      SET version = version + 1, updated_at = now()
      WHERE organization_id = p_organization_id
      RETURNING version, direct_version INTO v_version, v_direct;
    IF v_direct > p_expected_version OR EXISTS (
      SELECT 1 FROM public.world_buckets b
      WHERE b.organization_id = p_organization_id
        AND b.bucket = ANY (p_read_buckets)
        AND b.version > p_expected_version
    ) THEN
      RAISE EXCEPTION 'world: o que esta ação leu mudou depois da leitura' USING ERRCODE = '40001';
    END IF;
  END IF;

  -- Marca os baldes do que esta gravacao muda (quem leu isso conflita).
  IF p_write_buckets IS NOT NULL THEN
    INSERT INTO public.world_buckets (organization_id, bucket, version)
      SELECT p_organization_id, b, v_version FROM unnest(p_write_buckets) AS b
      ON CONFLICT (organization_id, bucket) DO UPDATE SET version = excluded.version;
  END IF;

  -- Exclusoes primeiro (ordem inversa das chaves estrangeiras, vinda do app).
  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_changes->'deletes', '[]'::jsonb)) LOOP
    v_table := v_item->>'table';
    v_pk := v_item->>'pk';
    IF NOT v_table = ANY (v_allowed) OR v_table IN ('organizations', 'units', 'audit_logs') THEN
      RAISE EXCEPTION 'world: exclusão não permitida em %', v_table USING ERRCODE = '42501';
    END IF;
    EXECUTE format('DELETE FROM public.%I WHERE %I::text = $1 AND organization_id = $2', v_table, v_pk)
      USING v_item->>'key', p_organization_id;
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_changes->'upserts', '[]'::jsonb)) LOOP
    v_table := v_item->>'table';
    v_pk := v_item->>'pk';
    v_row := v_item->'row';
    IF NOT v_table = ANY (v_allowed) THEN
      RAISE EXCEPTION 'world: tabela fora do mundo: %', v_table USING ERRCODE = '42501';
    END IF;

    -- A linha e do espaco da sessao.
    v_scope_col := CASE WHEN v_table = 'organizations' THEN 'id' ELSE 'organization_id' END;
    IF v_row->>v_scope_col IS DISTINCT FROM p_organization_id THEN
      RAISE EXCEPTION 'world: linha de outro espaço em %', v_table USING ERRCODE = '42501';
    END IF;

    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE %I::text = $1)', v_table, v_pk)
      INTO v_exists USING v_row->>v_pk;

    SELECT string_agg(format('%I', k), ', '), string_agg(format('%I', k), ', ') FILTER (WHERE k <> v_pk)
      INTO v_cols, v_set
      FROM jsonb_object_keys(v_row) AS k;

    IF v_exists THEN
      -- A linha com esse id e de outro espaco: recusa (antes o UPDATE pela chave
      -- a trazia para este espaco; com ids fixos dos testes, isso cruzava espacos).
      EXECUTE format('SELECT %I::text FROM public.%I WHERE %I::text = $1', v_scope_col, v_table, v_pk)
        INTO v_owner USING v_row->>v_pk;
      IF v_owner IS DISTINCT FROM p_organization_id THEN
        RAISE EXCEPTION 'world: % % já existe em outro espaço', v_table, v_row->>v_pk USING ERRCODE = '42501';
      END IF;
      -- Concorrencia: quem leu antes de outra gravacao nao sobrescreve.
      IF v_item ? 'expected' THEN
        EXECUTE format('SELECT updated_at FROM public.%I WHERE %I::text = $1', v_table, v_pk)
          INTO v_current USING v_row->>v_pk;
        IF v_current IS DISTINCT FROM (v_item->>'expected')::timestamptz THEN
          RAISE EXCEPTION 'world: % mudou depois da leitura', v_table USING ERRCODE = '40001';
        END IF;
      END IF;
      -- UPDATE (e nao INSERT ... ON CONFLICT): tabelas sem politica de insercao
      -- para o usuario, como organizations, so aceitam atualizacao.
      IF v_set IS NOT NULL THEN
        EXECUTE format(
          'UPDATE public.%1$I AS t SET (%2$s) = (SELECT %2$s FROM jsonb_populate_record(NULL::public.%1$I, $1)) WHERE t.%3$I::text = $1->>%4$L',
          v_table, v_set, v_pk, v_pk
        ) USING v_row;
      END IF;
    ELSE
      EXECUTE format(
        'INSERT INTO public.%1$I (%2$s) SELECT %2$s FROM jsonb_populate_record(NULL::public.%1$I, $1)',
        v_table, v_cols
      ) USING v_row;
    END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_world_changes(text, jsonb, bigint, integer[], integer[]) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_world_changes(text, jsonb, bigint, integer[], integer[]) TO service_role;

-- Gravacao do motor devolvendo a versao nova e as linhas como ficaram no banco.
CREATE OR REPLACE FUNCTION public.apply_world_changes_returning(
  p_organization_id text,
  p_changes jsonb,
  p_expected_version bigint,
  p_read_buckets integer[] DEFAULT NULL,
  p_write_buckets integer[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_row jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_version bigint;
BEGIN
  PERFORM public.apply_world_changes(p_organization_id, p_changes, p_expected_version, p_read_buckets, p_write_buckets);
  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_changes->'upserts', '[]'::jsonb)) LOOP
    EXECUTE format('SELECT to_jsonb(t.*) FROM public.%I AS t WHERE t.%I::text = $1', v_item->>'table', v_item->>'pk')
      INTO v_row USING v_item->'row'->>(v_item->>'pk');
    v_rows := v_rows || jsonb_build_array(jsonb_build_object('table', v_item->>'table', 'row', v_row));
  END LOOP;
  SELECT version INTO v_version FROM public.world_versions WHERE organization_id = p_organization_id;
  RETURN jsonb_build_object('version', v_version, 'rows', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_world_changes_returning(text, jsonb, bigint, integer[], integer[]) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_world_changes_returning(text, jsonb, bigint, integer[], integer[]) TO service_role;
