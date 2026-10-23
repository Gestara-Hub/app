-- =============================================================================
-- Migration: 20261023000041_world_writes_stay_in_space.sql
-- Description: apply_world_changes so atualiza linha do proprio espaco. Antes,
--   a existencia e o UPDATE eram so pela chave primaria: um id que ja existisse
--   em outro espaco era "trazido" para este (os e2e, com ids fixos como "c-a",
--   cruzavam espacos e a limpeza deles falhava). Em producao os ids sao UUID e
--   nao colidem; agora a gravacao recusa (42501) em vez de mexer em outro espaco.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.apply_world_changes(p_organization_id text, p_changes jsonb, p_expected_version bigint)
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
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'world: espaço ausente' USING ERRCODE = '42501';
  END IF;

  -- Versao do espaco: a leitura do servidor viu a versao p_expected_version;
  -- se outra gravacao entrou no meio, aborta (o servidor tenta de novo). O
  -- UPDATE trava a linha e serializa gravacoes do mesmo espaco.
  INSERT INTO public.world_versions (organization_id) VALUES (p_organization_id) ON CONFLICT DO NOTHING;
  UPDATE public.world_versions
    SET version = version + 1, updated_at = now()
    WHERE organization_id = p_organization_id AND version = p_expected_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'world: o espaço mudou depois da leitura' USING ERRCODE = '40001';
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
