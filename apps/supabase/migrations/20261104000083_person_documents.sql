-- =============================================================================
-- Migration: 20261104000083_person_documents.sql
-- Description: documentos da ficha do aluno e do instrutor (doc product/28):
--   atestado, termo assinado, autorizacao de imagem, registro profissional.
--   O arquivo fica no bucket privado 'attachments'; a linha guarda o tipo, a
--   validade e de quem e. Gravado pelo servidor (apply_world_changes, lista
--   v_allowed abaixo). Ler direto pelo banco: so proprietario, gerente e
--   atendente (o professor ve os dos alunos dele pelo servidor, que confere a
--   turma). Atestado e laudo sao dado de saude (LGPD, dado sensivel).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.person_documents (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_kind text NOT NULL CHECK (owner_kind IN ('client', 'professional')),
  client_id text REFERENCES public.clients(id) ON DELETE CASCADE,
  professional_id text REFERENCES public.professionals(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'medical_certificate', 'liability_waiver', 'image_authorization', 'medical_report', 'graduation_proof',
    'professional_registration', 'certification', 'background_check', 'contract', 'other'
  )),
  title text,
  -- Metadados do arquivo (FileAttachment: id do anexo, nome, tipo, tamanho).
  file jsonb NOT NULL,
  expires_on date,
  notes text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT person_documents_owner CHECK (
    (owner_kind = 'client' AND client_id IS NOT NULL AND professional_id IS NULL)
    OR (owner_kind = 'professional' AND professional_id IS NOT NULL AND client_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_person_documents_client ON public.person_documents(organization_id, client_id);
CREATE INDEX IF NOT EXISTS idx_person_documents_professional ON public.person_documents(organization_id, professional_id);
CREATE INDEX IF NOT EXISTS idx_person_documents_expires ON public.person_documents(organization_id, expires_on)
  WHERE expires_on IS NOT NULL;
-- A rota de anexos recusa o arquivo de um documento (o download passa pela rota propria).
CREATE INDEX IF NOT EXISTS idx_person_documents_file ON public.person_documents((file->>'id'));

CREATE TRIGGER trg_person_documents_updated_at
  BEFORE UPDATE ON public.person_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.person_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY person_documents_select_own ON public.person_documents
  FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT public.current_organization_id())
    AND (SELECT public.current_user_profile()) IN ('owner', 'manager', 'attendant')
  );
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.person_documents FROM anon, authenticated;
-- Mesma barreira das outras tabelas: sem o segundo fator, nada (migracao 70).
CREATE POLICY require_second_factor ON public.person_documents AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.second_factor_ok())) WITH CHECK ((SELECT public.second_factor_ok()));

-- A gravacao do mundo passa a aceitar a tabela (mesma funcao da migracao 80).
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

-- A exportacao dos dados do espaco (LGPD) leva os documentos (mesma funcao da migracao 75).
CREATE OR REPLACE FUNCTION platform.export_space(
  p_org text, p_reason text, p_admin uuid, p_admin_name text, p_ip text, p_ua text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
DECLARE
  v_tables text[] := ARRAY[
    'units', 'users', 'roles', 'professionals', 'clients', 'categories', 'class_groups', 'enrollments',
    'attendances', 'class_reservations', 'class_session_overrides', 'waitlist', 'assessments',
    'student_measurements', 'person_documents', 'attachments',
    'plans', 'lesson_packages', 'student_packages', 'charges', 'online_payments', 'financial_categories',
    'financial_entries', 'financial_recurrences', 'teacher_pay_rules', 'teacher_payouts', 'message_templates',
    'message_logs', 'legal_consents', 'subscription_events', 'audit_logs'
  ];
  v_table text;
  v_rows jsonb;
  v_result jsonb;
  v_label text := 'Suporte do GestaraHub';
  v_org jsonb;
BEGIN
  IF length(trim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Diga o motivo da exportação.' USING ERRCODE = '22023'; END IF;
  SELECT to_jsonb(o) - 'gateway_api_key' - 'gateway_wallet_id' - 'gateway_account_id' INTO v_org FROM public.organizations o WHERE o.id = p_org;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Espaço não encontrado.' USING ERRCODE = 'P0002'; END IF;
  v_result := jsonb_build_object('exportedAt', now(), 'organization', v_org);
  FOREACH v_table IN ARRAY v_tables LOOP
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
       WHERE c.table_schema = 'public' AND c.table_name = v_table AND c.column_name = 'organization_id');
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM public.%I t WHERE t.organization_id = $1', v_table)
      INTO v_rows USING p_org;
    -- Tira qualquer campo que pareca segredo, mesmo dentro das linhas.
    SELECT coalesce(jsonb_agg(
             (SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) FROM jsonb_each(row_) AS e(k, v)
               WHERE k !~* '(token|secret|hash|api_key|password|wallet|totp)')), '[]'::jsonb)
      INTO v_rows FROM jsonb_array_elements(v_rows) AS r(row_);
    v_result := v_result || jsonb_build_object(v_table, v_rows);
  END LOOP;
  INSERT INTO public.audit_logs (id, organization_id, actor, action, target, summary, changes, security, source)
  VALUES (gen_random_uuid(), p_org,
          jsonb_build_object('kind', 'system', 'userId', 'platform', 'name', v_label, 'profile', 'owner'),
          'updated', jsonb_build_object('type', 'space', 'id', p_org, 'label', 'Exportação dos dados do espaço'),
          v_label || ' exportou os dados do espaço', NULL, true, 'platform');
  INSERT INTO platform.audit_logs (admin_id, admin_name, action, organization_id, target, reason, ip, user_agent)
  VALUES (p_admin, p_admin_name, 'space.data_export', p_org, '{}'::jsonb, p_reason, p_ip, p_ua);
  RETURN v_result;
END $$;
