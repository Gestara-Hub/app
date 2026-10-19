-- Migration: 20261019000007_finance_and_teacher_pay.sql
-- Description: Fatia 6 — Financeiro (Categorias, Recorrências, Lançamentos, Regras de Remuneração e Fechamentos de Professores)

-- =============================================================================
-- 1. Categorias Financeiras (Financial Categories)
-- =============================================================================
CREATE TABLE public.financial_categories (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  name text NOT NULL,
  system boolean NOT NULL DEFAULT false,
  system_key text CHECK (system_key IS NULL OR system_key IN ('memberships', 'dropins', 'extras', 'courses', 'packages', 'teachers')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_financial_categories_org_type_name UNIQUE (organization_id, type, name)
);

CREATE INDEX idx_financial_categories_org ON public.financial_categories(organization_id);
CREATE INDEX idx_financial_categories_type ON public.financial_categories(organization_id, type);

CREATE TRIGGER trg_financial_categories_updated_at
  BEFORE UPDATE ON public.financial_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY financial_categories_select_own ON public.financial_categories
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY financial_categories_manage_own ON public.financial_categories
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  );

-- Helper para semear categorias padrao de sistema por organizacao
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
    ('fcat-' || org_id || '-products', org_id, 'income', 'Venda de produtos', false, null),
    ('fcat-' || org_id || '-events', org_id, 'income', 'Eventos e seminários', false, null),
    ('fcat-' || org_id || '-graduation', org_id, 'income', 'Taxa de graduação', false, null),
    ('fcat-' || org_id || '-other-income', org_id, 'income', 'Outras receitas', false, null),
    ('fcat-' || org_id || '-teachers', org_id, 'expense', 'Professores', true, 'teachers'),
    ('fcat-' || org_id || '-rent', org_id, 'expense', 'Aluguel', false, null),
    ('fcat-' || org_id || '-utilities', org_id, 'expense', 'Contas (luz, água, internet)', false, null),
    ('fcat-' || org_id || '-equipment', org_id, 'expense', 'Material e equipamentos', false, null),
    ('fcat-' || org_id || '-marketing', org_id, 'expense', 'Marketing', false, null),
    ('fcat-' || org_id || '-taxes', org_id, 'expense', 'Impostos e taxas', false, null),
    ('fcat-' || org_id || '-other-expense', org_id, 'expense', 'Outras despesas', false, null)
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- Trigger para criar categorias padrao automaticamente em novas organizacoes
CREATE OR REPLACE FUNCTION public.trg_seed_financial_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.seed_organization_financial_categories(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_organizations_seed_financial_categories
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.trg_seed_financial_categories();

-- Semeia para organizacoes existentes
DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_organization_financial_categories(org.id);
  END LOOP;
END;
$$;

-- =============================================================================
-- 2. Recorrências Financeiras (Financial Recurrences)
-- =============================================================================
CREATE TABLE public.financial_recurrences (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category_id text NOT NULL REFERENCES public.financial_categories(id) ON DELETE RESTRICT,
  description text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  day_of_month integer NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 28),
  start_competence text NOT NULL,
  end_competence text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_recurrences_org ON public.financial_recurrences(organization_id);
CREATE INDEX idx_financial_recurrences_status ON public.financial_recurrences(organization_id, status);

CREATE TRIGGER trg_financial_recurrences_updated_at
  BEFORE UPDATE ON public.financial_recurrences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.financial_recurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY financial_recurrences_select_own ON public.financial_recurrences
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  );

CREATE POLICY financial_recurrences_manage_own ON public.financial_recurrences
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  );

-- =============================================================================
-- 3. Lançamentos Financeiros (Financial Entries)
-- =============================================================================
CREATE TABLE public.financial_entries (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id text REFERENCES public.units(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category_id text NOT NULL REFERENCES public.financial_categories(id) ON DELETE RESTRICT,
  description text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'canceled')),
  paid_at timestamptz,
  method text,
  recurrence_id text REFERENCES public.financial_recurrences(id) ON DELETE SET NULL,
  recurrence_competence text,
  notes text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_entries_org ON public.financial_entries(organization_id);
CREATE INDEX idx_financial_entries_due_date ON public.financial_entries(organization_id, due_date);
CREATE INDEX idx_financial_entries_status ON public.financial_entries(organization_id, status);
CREATE INDEX idx_financial_entries_recurrence ON public.financial_entries(organization_id, recurrence_id);
CREATE INDEX idx_financial_entries_category ON public.financial_entries(organization_id, category_id);

CREATE TRIGGER trg_financial_entries_updated_at
  BEFORE UPDATE ON public.financial_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY financial_entries_select_own ON public.financial_entries
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  );

CREATE POLICY financial_entries_manage_own ON public.financial_entries
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  );

-- =============================================================================
-- 4. Regras de Pagamento de Professores (Teacher Pay Rules)
-- =============================================================================
CREATE TABLE public.teacher_pay_rules (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  professional_id text NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  payment_day integer NOT NULL DEFAULT 5 CHECK (payment_day >= 1 AND payment_day <= 28),
  start_competence text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_teacher_pay_rules_org_prof UNIQUE (organization_id, professional_id)
);

CREATE INDEX idx_teacher_pay_rules_org ON public.teacher_pay_rules(organization_id);

CREATE TRIGGER trg_teacher_pay_rules_updated_at
  BEFORE UPDATE ON public.teacher_pay_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.teacher_pay_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY teacher_pay_rules_select_own ON public.teacher_pay_rules
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  );

CREATE POLICY teacher_pay_rules_manage_own ON public.teacher_pay_rules
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  );

-- =============================================================================
-- 5. Fechamentos de Professores (Teacher Payouts)
-- =============================================================================
CREATE TABLE public.teacher_payouts (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  professional_id text NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  competence text NOT NULL,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paid', 'canceled')),
  closed_at timestamptz,
  paid_at timestamptz,
  method text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  counted_charge_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_teacher_payouts_org_prof_comp UNIQUE (organization_id, professional_id, competence)
);

CREATE INDEX idx_teacher_payouts_org ON public.teacher_payouts(organization_id);
CREATE INDEX idx_teacher_payouts_comp ON public.teacher_payouts(organization_id, competence);

CREATE TRIGGER trg_teacher_payouts_updated_at
  BEFORE UPDATE ON public.teacher_payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.teacher_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY teacher_payouts_select_own ON public.teacher_payouts
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  );

CREATE POLICY teacher_payouts_manage_own ON public.teacher_payouts
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  );
