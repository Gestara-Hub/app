-- =============================================================================
-- Migration: 20261109000091_events.sql
-- Description: Eventos e seminarios (doc product/29, decidido em 09/11/2026):
--   modulo proprio, separado das turmas. Evento com dias soltos, instrutor da
--   equipe ou convidado so pelo nome, inscricao unica ou por dia, cobranca
--   fechada (lote opcional), por dia ou sem cobranca, e chamada por dia.
--   Cobrancas ganham o tipo 'event' e o vinculo com o evento; lancamentos do
--   financeiro ganham o vinculo com o evento (financeiro proprio do evento);
--   a categoria "Eventos e seminários" vira categoria de sistema (fonte
--   automatica das inscricoes). Gravacao pelo servidor (apply_world_changes).
-- =============================================================================

-- 1. Evento --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id text NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  modality_id text REFERENCES public.categories(id) ON DELETE SET NULL,
  instructor_id text REFERENCES public.professionals(id) ON DELETE SET NULL,
  guest_instructor_name text,
  guest_instructor_origin text,
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  billing_mode text NOT NULL CHECK (billing_mode IN ('fixed', 'per_day', 'free')),
  price_cents integer CHECK (price_cents IS NULL OR price_cents >= 0),
  max_installments integer CHECK (max_installments IS NULL OR (max_installments BETWEEN 1 AND 12)),
  day_price_cents integer CHECK (day_price_cents IS NULL OR day_price_cents >= 0),
  early_bird_price_cents integer CHECK (early_bird_price_cents IS NULL OR early_bird_price_cents >= 0),
  early_bird_until date,
  counts_for_progression boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled')),
  canceled_at timestamptz,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Quem conduz: alguem da equipe ou um convidado pelo nome, nunca nenhum.
  CONSTRAINT events_instructor CHECK (instructor_id IS NOT NULL OR guest_instructor_name IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_events_org ON public.events(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_instructor ON public.events(organization_id, instructor_id);
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Dias do evento --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_sessions (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  date date NOT NULL,
  start text NOT NULL,
  "end" text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'done', 'canceled')),
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_sessions_event ON public.event_sessions(organization_id, event_id);
CREATE INDEX IF NOT EXISTS idx_event_sessions_date ON public.event_sessions(organization_id, date);
CREATE TRIGGER trg_event_sessions_updated_at BEFORE UPDATE ON public.event_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Inscricoes --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'full' CHECK (scope IN ('full', 'days')),
  session_ids jsonb,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlist', 'canceled')),
  amount_cents integer NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  installments integer NOT NULL DEFAULT 1 CHECK (installments BETWEEN 1 AND 12),
  installment_group_id text,
  registered_at timestamptz NOT NULL DEFAULT now(),
  canceled_at timestamptz,
  cancellation_reason text
);
CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON public.event_registrations(organization_id, event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_student ON public.event_registrations(organization_id, student_id);

-- 4. Chamada por dia ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_attendances (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  session_id text NOT NULL REFERENCES public.event_sessions(id) ON DELETE CASCADE,
  registration_id text NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('present', 'absent')),
  marked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_attendances_one_per_day UNIQUE (session_id, registration_id)
);
CREATE INDEX IF NOT EXISTS idx_event_attendances_session ON public.event_attendances(organization_id, session_id);
CREATE INDEX IF NOT EXISTS idx_event_attendances_event ON public.event_attendances(organization_id, event_id);

-- 5. RLS: todo membro do espaco le (o servidor recorta o professor); gravacao so pelo servidor.
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendances ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_select_own ON public.events FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.current_organization_id()));
CREATE POLICY event_sessions_select_own ON public.event_sessions FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.current_organization_id()));
CREATE POLICY event_registrations_select_own ON public.event_registrations FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.current_organization_id()));
CREATE POLICY event_attendances_select_own ON public.event_attendances FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.current_organization_id()));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.events, public.event_sessions, public.event_registrations, public.event_attendances
  FROM anon, authenticated;
-- Mesma barreira das outras tabelas: sem o segundo fator, nada (migracao 70).
CREATE POLICY require_second_factor ON public.events AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.second_factor_ok())) WITH CHECK ((SELECT public.second_factor_ok()));
CREATE POLICY require_second_factor ON public.event_sessions AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.second_factor_ok())) WITH CHECK ((SELECT public.second_factor_ok()));
CREATE POLICY require_second_factor ON public.event_registrations AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.second_factor_ok())) WITH CHECK ((SELECT public.second_factor_ok()));
CREATE POLICY require_second_factor ON public.event_attendances AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.second_factor_ok())) WITH CHECK ((SELECT public.second_factor_ok()));

-- 6. Cobrancas: tipo 'event' e vinculo com o evento e a inscricao.
ALTER TABLE public.charges DROP CONSTRAINT IF EXISTS charges_kind_check;
ALTER TABLE public.charges ADD CONSTRAINT charges_kind_check
  CHECK (kind IN ('membership', 'dropin', 'extra', 'course', 'package', 'event'));
ALTER TABLE public.charges ADD COLUMN IF NOT EXISTS event_id text REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.charges ADD COLUMN IF NOT EXISTS event_registration_id text REFERENCES public.event_registrations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_charges_event ON public.charges(organization_id, event_id) WHERE event_id IS NOT NULL;

-- 7. Lancamentos do financeiro ligados a um evento (financeiro proprio do evento).
ALTER TABLE public.financial_entries ADD COLUMN IF NOT EXISTS event_id text REFERENCES public.events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_financial_entries_event ON public.financial_entries(organization_id, event_id) WHERE event_id IS NOT NULL;

-- 8. "Eventos e seminários" vira categoria de sistema (fonte automatica das inscricoes).
ALTER TABLE public.financial_categories DROP CONSTRAINT IF EXISTS financial_categories_system_key_check;
ALTER TABLE public.financial_categories
  ADD CONSTRAINT financial_categories_system_key_check
  CHECK (system_key IS NULL OR system_key IN ('memberships', 'dropins', 'extras', 'courses', 'packages', 'events', 'teachers', 'online_fees'));

CREATE OR REPLACE FUNCTION public.seed_organization_financial_categories(org_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.financial_categories (id, organization_id, type, name, system, system_key)
  VALUES
    ('fcat-' || org_id || '-memberships', org_id, 'income', 'Mensalidades', true, 'memberships'),
    ('fcat-' || org_id || '-dropins', org_id, 'income', 'Aulas avulsas', true, 'dropins'),
    ('fcat-' || org_id || '-extras', org_id, 'income', 'Cobranças avulsas', true, 'extras'),
    ('fcat-' || org_id || '-courses', org_id, 'income', 'Cursos', true, 'courses'),
    ('fcat-' || org_id || '-packages', org_id, 'income', 'Pacotes de aulas', true, 'packages'),
    ('fcat-' || org_id || '-events', org_id, 'income', 'Eventos e seminários', true, 'events'),
    ('fcat-' || org_id || '-products', org_id, 'income', 'Venda de produtos', false, null),
    ('fcat-' || org_id || '-graduation', org_id, 'income', 'Taxa de graduação', false, null),
    ('fcat-' || org_id || '-other-income', org_id, 'income', 'Outras receitas', false, null),
    ('fcat-' || org_id || '-teachers', org_id, 'expense', 'Professores', true, 'teachers'),
    ('fcat-' || org_id || '-online_fees', org_id, 'expense', 'Taxas de pagamento online', true, 'online_fees'),
    ('fcat-' || org_id || '-rent', org_id, 'expense', 'Aluguel', false, null),
    ('fcat-' || org_id || '-utilities', org_id, 'expense', 'Contas (luz, água, internet)', false, null),
    ('fcat-' || org_id || '-equipment', org_id, 'expense', 'Material e equipamentos', false, null),
    ('fcat-' || org_id || '-marketing', org_id, 'expense', 'Marketing', false, null),
    ('fcat-' || org_id || '-taxes', org_id, 'expense', 'Impostos e taxas', false, null),
    ('fcat-' || org_id || '-other-expense', org_id, 'expense', 'Outras despesas', false, null)
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- Espacos que ja tem a categoria (criada como comum) passam a te-la como de sistema;
-- quem ja tem as categorias padrao e nao tem esta, ganha.
UPDATE public.financial_categories
  SET system = true, system_key = 'events'
  WHERE system_key IS NULL AND id = 'fcat-' || organization_id || '-events';
INSERT INTO public.financial_categories (id, organization_id, type, name, system, system_key)
SELECT 'fcat-' || o.id || '-events', o.id, 'income', 'Eventos e seminários', true, 'events'
FROM public.organizations o
WHERE EXISTS (SELECT 1 FROM public.financial_categories c WHERE c.organization_id = o.id)
ON CONFLICT (id) DO NOTHING;

-- 9. A gravacao do mundo aceita as tabelas novas (mesma funcao da migracao 83).
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

-- 10. A exportacao dos dados do espaco (LGPD) leva os eventos (mesma funcao da migracao 83).
CREATE OR REPLACE FUNCTION platform.export_space(
  p_org text, p_reason text, p_admin uuid, p_admin_name text, p_ip text, p_ua text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
DECLARE
  v_tables text[] := ARRAY[
    'units', 'users', 'roles', 'professionals', 'clients', 'categories', 'class_groups', 'enrollments',
    'attendances', 'class_reservations', 'class_session_overrides', 'waitlist', 'assessments',
    'student_measurements', 'person_documents', 'attachments',
    'events', 'event_sessions', 'event_registrations', 'event_attendances',
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
