-- =============================================================================
-- Migration: 20261031000074_world_writes_student_measurements.sql
-- Description: a gravacao do mundo (apply_world_changes) so escreve nas
--   tabelas da lista v_allowed. Entra student_measurements (testes e medidas,
--   migracao 73). O resto da funcao e a mesma da migracao 45.
-- =============================================================================

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
    'waitlist', 'class_reservations', 'class_session_overrides', 'assessments', 'student_measurements',
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
