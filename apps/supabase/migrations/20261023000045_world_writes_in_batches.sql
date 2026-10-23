-- =============================================================================
-- Migration: 20261023000045_world_writes_in_batches.sql
-- Description: Doc 19, secao 11. apply_world_changes grava por grupo, nao por
--   linha. Antes eram 3 consultas por linha (existe? de quem? updated_at) mais
--   a gravacao, e a volta das linhas era mais uma consulta por linha: de 1,5 a
--   3 ms por linha. Com o limite de 8 s por chamada (statement_timeout do
--   PostgREST), uma gravacao de alguns milhares de linhas (mensalidades de um
--   espaco grande, por exemplo) falhava inteira. As regras sao as mesmas:
--   linha do espaco da sessao, id de outro espaco recusado, `expected`
--   conferido, atualizacao so das colunas que vieram, insercao com os padroes
--   do banco, e a ordem entre os grupos e a que o app mandou.
-- =============================================================================

-- Exclusao de um grupo de linhas de uma tabela, so do espaco da sessao.
CREATE OR REPLACE FUNCTION public.world_delete_batch(p_organization_id text, p_table text, p_pk text, p_keys jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_pk_type text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO v_pk_type
    FROM pg_attribute a
   WHERE a.attrelid = format('public.%I', p_table)::regclass AND a.attname = p_pk;
  EXECUTE format(
    'DELETE FROM public.%1$I WHERE %2$I IN (SELECT k::%3$s FROM jsonb_array_elements_text($1) AS k) AND organization_id = $2',
    p_table, p_pk, v_pk_type
  ) USING p_keys, p_organization_id;
END;
$function$;

-- Gravacao de um grupo de linhas de uma tabela: as mesmas regras de antes,
-- linha a linha, agora por conjunto:
-- 1. toda linha e do espaco da sessao;
-- 2. id que ja existe em outro espaco e recusado (42501);
-- 3. linha lida com `expected` (updated_at da leitura) que mudou depois: 40001;
-- 4. a que ja existe e atualizada so nas colunas que vieram (as outras ficam),
--    a que nao existe e inserida (colunas ausentes ficam com o padrao do banco).
CREATE OR REPLACE FUNCTION public.world_upsert_batch(p_organization_id text, p_table text, p_pk text, p_items jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_scope_col constant text := CASE WHEN p_table = 'organizations' THEN 'id' ELSE 'organization_id' END;
  v_pk_type text;
  v_bad boolean;
  v_set text;
  v_keyset record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) AS e WHERE e->'row'->>v_scope_col IS DISTINCT FROM p_organization_id
  ) THEN
    RAISE EXCEPTION 'world: linha de outro espaço em %', p_table USING ERRCODE = '42501';
  END IF;

  -- O id do json vira o tipo da coluna (uuid, text), para o banco usar o
  -- indice da chave (comparar `id::text` percorria a tabela inteira).
  SELECT format_type(a.atttypid, a.atttypmod) INTO v_pk_type
    FROM pg_attribute a
   WHERE a.attrelid = format('public.%I', p_table)::regclass AND a.attname = p_pk;

  -- Os ids do grupo, uma vez, numa tabela temporaria da transacao.
  DROP TABLE IF EXISTS pg_temp.world_batch;
  EXECUTE format(
    'CREATE TEMP TABLE world_batch ON COMMIT DROP AS
       SELECT (e->''row''->>%1$L)::%2$s AS key, e AS item, n FROM jsonb_array_elements($1) WITH ORDINALITY AS x(e, n)',
    p_pk, v_pk_type
  ) USING p_items;

  EXECUTE format(
    'SELECT bool_or(t.%2$I::text IS DISTINCT FROM $1) FROM public.%1$I AS t JOIN world_batch b ON t.%3$I = b.key',
    p_table, v_scope_col, p_pk
  ) INTO v_bad USING p_organization_id;
  IF coalesce(v_bad, false) THEN
    RAISE EXCEPTION 'world: linha de % já existe em outro espaço', p_table USING ERRCODE = '42501';
  END IF;

  -- Concorrencia: quem leu antes de outra gravacao nao sobrescreve. So quando
  -- alguma linha traz `expected` (tabela sem updated_at nunca traz).
  IF EXISTS (SELECT 1 FROM world_batch WHERE item ? 'expected') THEN
    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1 FROM public.%1$I AS t JOIN world_batch b ON t.%2$I = b.key
          WHERE b.item ? ''expected'' AND t.updated_at IS DISTINCT FROM (b.item->>''expected'')::timestamptz)',
      p_table, p_pk
    ) INTO v_bad;
    IF v_bad THEN
      RAISE EXCEPTION 'world: % mudou depois da leitura', p_table USING ERRCODE = '40001';
    END IF;
  END IF;

  -- Atualizacao das que existem, nas colunas que vieram em alguma linha do
  -- grupo; a linha que nao trouxe uma coluna fica com o valor atual (base = a
  -- propria linha). UPDATE (e nao INSERT ... ON CONFLICT): tabelas sem politica
  -- de insercao para o usuario, como organizations, so aceitam atualizacao.
  SELECT string_agg(DISTINCT format('%I', k), ', ')
    INTO v_set
    FROM world_batch AS b, jsonb_object_keys(b.item->'row') AS k
    WHERE k <> p_pk;
  IF v_set IS NOT NULL THEN
    EXECUTE format(
      'UPDATE public.%1$I AS t SET (%2$s) = (SELECT %2$s FROM jsonb_populate_record(t, b.item->''row''))
         FROM world_batch AS b WHERE t.%3$I = b.key',
      p_table, v_set, p_pk
    );
  END IF;

  -- Insercao das novas, por conjunto de colunas (as ausentes ficam com o padrao).
  FOR v_keyset IN EXECUTE format(
    'SELECT cols, jsonb_agg(item->''row'' ORDER BY n) AS rows
       FROM (
         SELECT b.item, b.n,
                (SELECT string_agg(format(''%%I'', k), '', '' ORDER BY k) FROM jsonb_object_keys(b.item->''row'') AS k) AS cols
           FROM world_batch AS b
          WHERE NOT EXISTS (SELECT 1 FROM public.%1$I AS t WHERE t.%2$I = b.key)
       ) AS fresh
      GROUP BY cols',
    p_table, p_pk
  )
  LOOP
    EXECUTE format(
      'INSERT INTO public.%1$I (%2$s) SELECT %2$s FROM jsonb_populate_recordset(NULL::public.%1$I, $1)',
      p_table, v_keyset.cols
    ) USING v_keyset.rows;
  END LOOP;
  DROP TABLE IF EXISTS pg_temp.world_batch;
END;
$function$;

REVOKE ALL ON FUNCTION public.world_delete_batch(text, text, text, jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.world_upsert_batch(text, text, text, jsonb) FROM public, anon, authenticated;

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
  v_group record;
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

  -- Cada lista vira grupos seguidos da mesma tabela (e, nas gravacoes, do
  -- mesmo tipo), na ordem do app: um comando por grupo em vez de tres
  -- consultas por linha (doc 19, secao 11). Os grupos saem de uma consulta so
  -- (juntar linha a linha num laco copiaria o lote a cada linha).
  FOR v_group IN
    WITH items AS (
      SELECT e, n, e->>'table' AS tbl, e->>'pk' AS pk
        FROM jsonb_array_elements(coalesce(p_changes->'deletes', '[]'::jsonb)) WITH ORDINALITY AS x(e, n)
    ), marked AS (
      SELECT *, CASE WHEN tbl IS DISTINCT FROM lag(tbl) OVER (ORDER BY n) THEN 1 ELSE 0 END AS starts FROM items
    ), numbered AS (
      SELECT *, sum(starts) OVER (ORDER BY n) AS grp FROM marked
    )
    SELECT grp, min(tbl) AS tbl, min(pk) AS pk, jsonb_agg(e->>'key' ORDER BY n) AS items
      FROM numbered GROUP BY grp ORDER BY grp
  LOOP
    IF NOT v_group.tbl = ANY (v_allowed) OR v_group.tbl IN ('organizations', 'units', 'audit_logs') THEN
      RAISE EXCEPTION 'world: exclusão não permitida em %', v_group.tbl USING ERRCODE = '42501';
    END IF;
    PERFORM public.world_delete_batch(p_organization_id, v_group.tbl, v_group.pk, v_group.items);
  END LOOP;

  FOR v_group IN
    WITH items AS (
      SELECT e, n, e->>'table' AS tbl, e->>'pk' AS pk, coalesce(e->>'op', 'upsert') AS op
        FROM jsonb_array_elements(coalesce(p_changes->'upserts', '[]'::jsonb)) WITH ORDINALITY AS x(e, n)
    ), marked AS (
      SELECT *, CASE WHEN (tbl, op) IS DISTINCT FROM (lag(tbl) OVER (ORDER BY n), lag(op) OVER (ORDER BY n)) THEN 1 ELSE 0 END AS starts
        FROM items
    ), numbered AS (
      SELECT *, sum(starts) OVER (ORDER BY n) AS grp FROM marked
    )
    SELECT grp, min(tbl) AS tbl, min(pk) AS pk, jsonb_agg(e ORDER BY n) AS items
      FROM numbered GROUP BY grp ORDER BY grp
  LOOP
    IF NOT v_group.tbl = ANY (v_allowed) THEN
      RAISE EXCEPTION 'world: tabela fora do mundo: %', v_group.tbl USING ERRCODE = '42501';
    END IF;
    PERFORM public.world_upsert_batch(p_organization_id, v_group.tbl, v_group.pk, v_group.items);
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
  v_group record;
  v_pk_type text;
  v_found jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_version bigint;
BEGIN
  PERFORM public.apply_world_changes(p_organization_id, p_changes, p_expected_version, p_read_buckets, p_write_buckets);
  -- Linhas gravadas como ficaram, uma consulta por tabela (antes, uma por linha).
  FOR v_group IN
    SELECT e->>'table' AS tbl, e->>'pk' AS pk, jsonb_agg(e->'row'->>(e->>'pk')) AS keys
      FROM jsonb_array_elements(coalesce(p_changes->'upserts', '[]'::jsonb)) AS e
     GROUP BY 1, 2
  LOOP
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_pk_type
      FROM pg_attribute a
     WHERE a.attrelid = format('public.%I', v_group.tbl)::regclass AND a.attname = v_group.pk;
    EXECUTE format(
      'SELECT coalesce(jsonb_agg(jsonb_build_object(''table'', %1$L, ''row'', to_jsonb(t.*))), ''[]''::jsonb)
         FROM public.%1$I AS t WHERE t.%2$I IN (SELECT k::%3$s FROM jsonb_array_elements_text($1) AS k)',
      v_group.tbl, v_group.pk, v_pk_type
    ) INTO v_found USING v_group.keys;
    v_rows := v_rows || v_found;
  END LOOP;
  SELECT version INTO v_version FROM public.world_versions WHERE organization_id = p_organization_id;
  RETURN jsonb_build_object('version', v_version, 'rows', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_world_changes_returning(text, jsonb, bigint, integer[], integer[]) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_world_changes_returning(text, jsonb, bigint, integer[], integer[]) TO service_role;
