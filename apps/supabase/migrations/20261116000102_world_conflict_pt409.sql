-- =============================================================================
-- Migration: 20261116000102_world_conflict_pt409.sql
-- Description: Troca ERRCODE '40001' por 'PT409' nos conflitos otimistas de
--   world_upsert_batch (migracao 45) e apply_world_changes (migracao 91).
--   O PostgREST interpreta SQLSTATE 40001 como falha transitoria de
--   serializacao do Postgres e entra em retry automatico interno repetindo a
--   mesma chamada com p_expected_version velho de 1 em 1 segundo em loop
--   infinito. PT409 devolve HTTP 409 Conflict imediatamente para o servidor Next
--   reler a versao atual e tentar de novo (serviceRunner).
-- =============================================================================

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
      RAISE EXCEPTION 'world: % mudou depois da leitura', p_table USING ERRCODE = 'PT409';
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
    'waitlist', 'class_reservations', 'class_session_overrides', 'assessments', 'student_measurements', 'issued_certificates', 'person_documents',
    'events', 'event_sessions', 'event_registrations', 'event_attendances',
    'financial_categories',
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
      RAISE EXCEPTION 'world: o espaço mudou depois da leitura' USING ERRCODE = 'PT409';
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
      RAISE EXCEPTION 'world: o que esta ação leu mudou depois da leitura' USING ERRCODE = 'PT409';
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
