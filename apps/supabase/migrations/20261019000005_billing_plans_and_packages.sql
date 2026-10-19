-- Migration: 20261019000005_billing_plans_and_packages.sql
-- Description: Fatia 4 — Planos, Pacotes de Aulas (Catálogo e Alunos) e Cobranças (Mensalidades, Bolsas, Avulsas, Cursos, Pacotes)

-- =============================================================================
-- 1. Tabela de Planos (Plans)
-- =============================================================================
CREATE TABLE public.plans (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  period text NOT NULL CHECK (period IN ('monthly', 'biweekly', 'weekly')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_plans_org ON public.plans(organization_id);
CREATE INDEX idx_plans_status ON public.plans(organization_id, status);
CREATE INDEX idx_plans_name ON public.plans(organization_id, name);

CREATE TRIGGER trg_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY plans_select_own ON public.plans
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY plans_manage_own ON public.plans
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  );

-- Opcional: FK em class_groups se existir
DO $$ BEGIN
  ALTER TABLE public.class_groups
    ADD CONSTRAINT fk_class_groups_plan
    FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- =============================================================================
-- 2. Tabela de Pacotes do Catálogo (Lesson Packages)
-- =============================================================================
CREATE TABLE public.lesson_packages (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  lessons integer NOT NULL CHECK (lessons >= 1 AND lessons <= 200),
  price_cents integer NOT NULL CHECK (price_cents > 0),
  validity_days integer CHECK (validity_days IS NULL OR (validity_days >= 1 AND validity_days <= 730)),
  class_group_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  modality_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  absence_consumes boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_packages_org ON public.lesson_packages(organization_id);
CREATE INDEX idx_lesson_packages_status ON public.lesson_packages(organization_id, status);
CREATE INDEX idx_lesson_packages_name ON public.lesson_packages(organization_id, name);

CREATE TRIGGER trg_lesson_packages_updated_at
  BEFORE UPDATE ON public.lesson_packages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.lesson_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY lesson_packages_select_own ON public.lesson_packages
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY lesson_packages_manage_own ON public.lesson_packages
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
-- 3. Tabela de Pacotes dos Alunos (Student Packages)
-- =============================================================================
CREATE TABLE public.student_packages (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id text REFERENCES public.units(id) ON DELETE SET NULL,
  student_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  package_id text NOT NULL REFERENCES public.lesson_packages(id) ON DELETE RESTRICT,
  name text NOT NULL,
  lessons_total integer NOT NULL CHECK (lessons_total >= 0),
  lessons_used integer NOT NULL DEFAULT 0 CHECK (lessons_used >= 0),
  purchased_at date NOT NULL,
  expires_at date,
  class_group_ids jsonb,
  modality_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  absence_consumes boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'renewed', 'canceled')),
  carried_over_lessons integer,
  carried_from jsonb NOT NULL DEFAULT '[]'::jsonb,
  renewed_from_id text REFERENCES public.student_packages(id) ON DELETE SET NULL,
  renewed_into_id text REFERENCES public.student_packages(id) ON DELETE SET NULL,
  charge_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  usages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_packages_org ON public.student_packages(organization_id);
CREATE INDEX idx_student_packages_student ON public.student_packages(organization_id, student_id);
CREATE INDEX idx_student_packages_status ON public.student_packages(organization_id, status);
CREATE INDEX idx_student_packages_package ON public.student_packages(organization_id, package_id);

CREATE TRIGGER trg_student_packages_updated_at
  BEFORE UPDATE ON public.student_packages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.student_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_packages_select_own ON public.student_packages
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY student_packages_manage_own ON public.student_packages
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
-- 4. Tabela de Cobranças (Charges)
-- =============================================================================
CREATE TABLE public.charges (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id text REFERENCES public.units(id) ON DELETE SET NULL,
  student_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('membership', 'dropin', 'extra', 'course', 'package')),
  plan_id text REFERENCES public.plans(id) ON DELETE SET NULL,
  class_group_id text REFERENCES public.class_groups(id) ON DELETE SET NULL,
  competence text,
  period_start date,
  period_end date,
  session_id text,
  due_date date NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  status text NOT NULL CHECK (status IN ('pending', 'paid', 'overdue', 'canceled', 'waived')),
  paid_at timestamptz,
  method text CHECK (method IS NULL OR method IN ('cash', 'pix', 'card', 'other')),
  paid_via text CHECK (paid_via IS NULL OR paid_via IN ('manual', 'online', 'recurring')),
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  canceled_by text CHECK (canceled_by IS NULL OR canceled_by IN ('system', 'user')),
  cancel_reason text,
  replaced boolean NOT NULL DEFAULT false,
  scholarship_percent integer,
  list_amount_cents integer,
  description text,
  installment_group_id text,
  enrollment_id text REFERENCES public.enrollments(id) ON DELETE SET NULL,
  student_package_id text REFERENCES public.student_packages(id) ON DELETE SET NULL,
  cycle_index integer,
  cycle_total integer,
  is_prorated boolean NOT NULL DEFAULT false,
  prorated_days integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_charges_org ON public.charges(organization_id);
CREATE INDEX idx_charges_student ON public.charges(organization_id, student_id);
CREATE INDEX idx_charges_competence ON public.charges(organization_id, competence);
CREATE INDEX idx_charges_due_date ON public.charges(organization_id, due_date);
CREATE INDEX idx_charges_status ON public.charges(organization_id, status);
CREATE INDEX idx_charges_kind ON public.charges(organization_id, kind);
CREATE INDEX idx_charges_plan ON public.charges(organization_id, plan_id);
CREATE INDEX idx_charges_class_group ON public.charges(organization_id, class_group_id);
CREATE INDEX idx_charges_student_package ON public.charges(organization_id, student_package_id);
CREATE INDEX idx_charges_installment_group ON public.charges(organization_id, installment_group_id);

CREATE TRIGGER trg_charges_updated_at
  BEFORE UPDATE ON public.charges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY charges_select_own ON public.charges
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY charges_manage_own ON public.charges
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  );

-- Opcional: FK em class_reservations se existir
DO $$ BEGIN
  ALTER TABLE public.class_reservations
    ADD CONSTRAINT fk_class_reservations_charge
    FOREIGN KEY (charge_id) REFERENCES public.charges(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL;
END $$;
