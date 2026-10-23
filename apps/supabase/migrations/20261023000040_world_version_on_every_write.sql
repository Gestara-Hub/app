-- =============================================================================
-- Migration: 20261023000040_world_version_on_every_write.sql
-- Description: Doc 19 (desempenho). A versao do espaco (world_versions) passa a
--   avancar em QUALQUER gravacao nas tabelas do espaco, nao so nas que passam
--   por apply_world_changes: webhook do Asaas, geracao de mensalidades,
--   configuracoes, convites e o que mais gravar direto.
--   1. O servidor pode guardar o espaco lido por (espaco, versao) e reaproveitar
--      enquanto a versao nao muda (cache do servidor, doc 19).
--   2. Gravacao direta no meio de uma leitura do motor tambem conta como
--      conflito (antes so o updated_at da linha protegia).
--   Avanca no maximo uma vez por transacao: o gatilho so mexe na versao se ela
--   ainda nao avancou nesta transacao (updated_at <> now()); apply_world_changes
--   ja avanca e marca updated_at = now(), entao os gatilhos dele nao repetem.
-- =============================================================================

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
    INSERT INTO public.world_versions (organization_id, version)
      SELECT org, 1 FROM unnest(v_orgs) AS org
      WHERE EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = org)
      ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.world_versions
    SET version = version + 1, updated_at = now()
    WHERE organization_id = ANY (v_orgs) AND updated_at <> now();
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_world_version() FROM PUBLIC;

-- Um gatilho por evento (tabela de transicao so vale com um evento por gatilho).
DO $$
DECLARE
  v_table text;
  v_column text;
  v_tables constant text[] := ARRAY[
    'organizations', 'units', 'users', 'roles', 'categories', 'professionals', 'clients', 'plans',
    'lesson_packages', 'student_packages', 'charges', 'class_groups', 'enrollments', 'attendances',
    'waitlist', 'class_reservations', 'class_session_overrides', 'assessments', 'financial_categories',
    'financial_recurrences', 'financial_entries', 'teacher_pay_rules', 'teacher_payouts', 'online_payments',
    'whatsapp_connections', 'message_templates', 'message_logs', 'audit_logs'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    v_column := CASE WHEN v_table = 'organizations' THEN 'id' ELSE 'organization_id' END;
    EXECUTE format('DROP TRIGGER IF EXISTS world_version_ins ON public.%I', v_table);
    EXECUTE format('DROP TRIGGER IF EXISTS world_version_upd ON public.%I', v_table);
    EXECUTE format('DROP TRIGGER IF EXISTS world_version_del ON public.%I', v_table);
    EXECUTE format(
      'CREATE TRIGGER world_version_ins AFTER INSERT ON public.%I REFERENCING NEW TABLE AS new_rows '
      'FOR EACH STATEMENT EXECUTE FUNCTION public.bump_world_version(%L)', v_table, v_column);
    EXECUTE format(
      'CREATE TRIGGER world_version_upd AFTER UPDATE ON public.%I REFERENCING NEW TABLE AS new_rows '
      'FOR EACH STATEMENT EXECUTE FUNCTION public.bump_world_version(%L)', v_table, v_column);
    EXECUTE format(
      'CREATE TRIGGER world_version_del AFTER DELETE ON public.%I REFERENCING OLD TABLE AS old_rows '
      'FOR EACH STATEMENT EXECUTE FUNCTION public.bump_world_version(%L)', v_table, v_column);
  END LOOP;
END;
$$;

-- Gravacao do motor devolvendo a versao nova e as linhas como ficaram no banco
-- (com updated_at e padroes do banco), na mesma transacao: o servidor atualiza
-- o espaco em cache para a versao nova sem reler tudo (doc 19).
CREATE OR REPLACE FUNCTION public.apply_world_changes_returning(p_organization_id text, p_changes jsonb, p_expected_version bigint)
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
  PERFORM public.apply_world_changes(p_organization_id, p_changes, p_expected_version);
  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_changes->'upserts', '[]'::jsonb)) LOOP
    EXECUTE format('SELECT to_jsonb(t.*) FROM public.%I AS t WHERE t.%I::text = $1', v_item->>'table', v_item->>'pk')
      INTO v_row USING v_item->'row'->>(v_item->>'pk');
    v_rows := v_rows || jsonb_build_array(jsonb_build_object('table', v_item->>'table', 'row', v_row));
  END LOOP;
  SELECT version INTO v_version FROM public.world_versions WHERE organization_id = p_organization_id;
  RETURN jsonb_build_object('version', v_version, 'rows', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_world_changes_returning(text, jsonb, bigint) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_world_changes_returning(text, jsonb, bigint) TO service_role;
