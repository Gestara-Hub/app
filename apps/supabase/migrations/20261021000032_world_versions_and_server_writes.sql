-- =============================================================================
-- Migration: 20261021000032_world_versions_and_server_writes.sql
-- Description: Doc 15, fatia 3.
--   1. Versao por espaco (world_versions): toda gravacao do servidor confere a
--      versao lida; outra gravacao no meio (outra aba, outro aparelho) aborta
--      com 40001 e o servidor roda a operacao de novo sobre o banco atual.
--      Capacidade, conflito de horario e parcelas deixam de furar com duas
--      abas, porque a regra sempre roda sobre o estado mais novo.
--   2. apply_world_changes so pelo servidor (service_role), depois de conferir
--      sessao e permissao do metodo: o usuario nao chama a funcao direto para
--      gravar linhas que a regra nao gravaria. Cada linha segue presa ao espaco.
--   3. Politicas que citavam perfis inexistentes ('teacher', 'receptionist')
--      passam a usar os perfis reais ('professional', 'attendant').
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.world_versions (
  organization_id text PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  version bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.world_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY world_versions_select_own ON public.world_versions
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

DROP FUNCTION IF EXISTS public.apply_world_changes(text, jsonb);

CREATE OR REPLACE FUNCTION public.apply_world_changes(p_organization_id text, p_changes jsonb, p_expected_version bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.apply_world_changes(text, jsonb, bigint) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_world_changes(text, jsonb, bigint) TO service_role;


-- 3. Perfis reais nas politicas.
DROP POLICY IF EXISTS assessments_manage_own ON public.assessments;
CREATE POLICY assessments_manage_own ON public.assessments
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND public.current_user_profile() IN ('owner', 'manager', 'professional'))
  WITH CHECK (organization_id = public.current_organization_id() AND public.current_user_profile() IN ('owner', 'manager', 'professional'));

DROP POLICY IF EXISTS attachments_manage_own ON public.attachments;
CREATE POLICY attachments_manage_own ON public.attachments
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND public.current_user_profile() IN ('owner', 'manager', 'attendant'))
  WITH CHECK (organization_id = public.current_organization_id() AND public.current_user_profile() IN ('owner', 'manager', 'attendant'));

DROP POLICY IF EXISTS message_logs_manage_own ON public.message_logs;
CREATE POLICY message_logs_manage_own ON public.message_logs
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND public.current_user_profile() IN ('owner', 'manager', 'attendant'))
  WITH CHECK (organization_id = public.current_organization_id() AND public.current_user_profile() IN ('owner', 'manager', 'attendant'));

DROP POLICY IF EXISTS message_logs_select_own ON public.message_logs;
CREATE POLICY message_logs_select_own ON public.message_logs
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id() AND public.current_user_profile() IN ('owner', 'manager', 'attendant'));

DROP POLICY IF EXISTS message_templates_select_own ON public.message_templates;
CREATE POLICY message_templates_select_own ON public.message_templates
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id() AND public.current_user_profile() IN ('owner', 'manager', 'attendant'));

DROP POLICY IF EXISTS whatsapp_connections_select_own ON public.whatsapp_connections;
CREATE POLICY whatsapp_connections_select_own ON public.whatsapp_connections
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id() AND public.current_user_profile() IN ('owner', 'manager', 'attendant'));
