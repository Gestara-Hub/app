-- Migration: 20261019000004_turmas_modalities_and_professionals.sql
-- Description: Fatia 3 — Modalidades, Profissionais/Instrutores, Turmas, Matrículas, Chamadas, Lista de Espera, Reservas e Substituições

-- 1. Garante unicidade do nome da categoria por organização
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_org_name ON public.categories(organization_id, name);

-- 2. Tabela de Profissionais (Instrutores e Equipe)
CREATE TABLE public.professionals (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id text NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  name text NOT NULL,
  role_id text REFERENCES public.roles(id) ON DELETE SET NULL,
  phone text,
  address jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  working_hours jsonb NOT NULL DEFAULT '[]'::jsonb,
  service_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  modality_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_professionals_org ON public.professionals(organization_id);
CREATE INDEX idx_professionals_unit ON public.professionals(organization_id, unit_id);
CREATE INDEX idx_professionals_status ON public.professionals(organization_id, status);
CREATE INDEX idx_professionals_name ON public.professionals(organization_id, name);

CREATE TRIGGER trg_professionals_updated_at
  BEFORE UPDATE ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

CREATE POLICY professionals_select_own ON public.professionals
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY professionals_manage_own ON public.professionals
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  );

-- 3. Tabela de Turmas (Class Groups)
CREATE TABLE public.class_groups (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id text NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  name text NOT NULL,
  modality_id text REFERENCES public.categories(id) ON DELETE SET NULL,
  instructor_id text NOT NULL REFERENCES public.professionals(id) ON DELETE RESTRICT,
  enrollment_type text NOT NULL DEFAULT 'fixed' CHECK (enrollment_type IN ('fixed', 'dropin')),
  capacity integer NOT NULL DEFAULT 20 CHECK (capacity >= 1),
  plan_id text,
  allow_dropin boolean NOT NULL DEFAULT false,
  session_price_cents integer CHECK (session_price_cents IS NULL OR session_price_cents >= 0),
  meeting_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  start_date date NOT NULL,
  end_date date,
  billing_mode text NOT NULL DEFAULT 'membership' CHECK (billing_mode IN ('membership', 'course', 'package', 'free')),
  course_price_cents integer CHECK (course_price_cents IS NULL OR course_price_cents > 0),
  course_max_installments integer CHECK (course_max_installments IS NULL OR (course_max_installments >= 1 AND course_max_installments <= 12)),
  schedule_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_class_groups_org ON public.class_groups(organization_id);
CREATE INDEX idx_class_groups_unit ON public.class_groups(organization_id, unit_id);
CREATE INDEX idx_class_groups_modality ON public.class_groups(organization_id, modality_id);
CREATE INDEX idx_class_groups_instructor ON public.class_groups(organization_id, instructor_id);
CREATE INDEX idx_class_groups_status ON public.class_groups(organization_id, status);

CREATE TRIGGER trg_class_groups_updated_at
  BEFORE UPDATE ON public.class_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.class_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY class_groups_select_own ON public.class_groups
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY class_groups_manage_own ON public.class_groups
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  );

-- 4. Tabela de Matrículas (Enrollments)
CREATE TABLE public.enrollments (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  class_group_id text NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'canceled')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  canceled_at timestamptz,
  cancellation_reason text,
  course jsonb,
  pays_with_package boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_enrollments_org ON public.enrollments(organization_id);
CREATE INDEX idx_enrollments_class ON public.enrollments(organization_id, class_group_id);
CREATE INDEX idx_enrollments_student ON public.enrollments(organization_id, student_id);
CREATE INDEX idx_enrollments_status ON public.enrollments(organization_id, status);

CREATE TRIGGER trg_enrollments_updated_at
  BEFORE UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY enrollments_select_own ON public.enrollments
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY enrollments_manage_own ON public.enrollments
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager', 'attendant', 'professional')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager', 'attendant', 'professional')
  );

-- 5. Tabela de Chamadas / Presenças (Attendances)
CREATE TABLE public.attendances (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  student_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'justified')),
  marked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, session_id, student_id)
);

CREATE INDEX idx_attendances_org ON public.attendances(organization_id);
CREATE INDEX idx_attendances_session ON public.attendances(organization_id, session_id);
CREATE INDEX idx_attendances_student ON public.attendances(organization_id, student_id);

CREATE TRIGGER trg_attendances_updated_at
  BEFORE UPDATE ON public.attendances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

CREATE POLICY attendances_select_own ON public.attendances
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY attendances_manage_own ON public.attendances
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager', 'attendant', 'professional')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager', 'attendant', 'professional')
  );

-- 6. Tabela de Fila de Espera (Waitlist)
CREATE TABLE public.waitlist (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  class_group_id text NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 1 CHECK (position >= 1),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'promoted', 'canceled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_waitlist_org ON public.waitlist(organization_id);
CREATE INDEX idx_waitlist_class ON public.waitlist(organization_id, class_group_id);
CREATE INDEX idx_waitlist_student ON public.waitlist(organization_id, student_id);
CREATE INDEX idx_waitlist_status ON public.waitlist(organization_id, status);

CREATE TRIGGER trg_waitlist_updated_at
  BEFORE UPDATE ON public.waitlist
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY waitlist_select_own ON public.waitlist
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY waitlist_manage_own ON public.waitlist
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager', 'attendant', 'professional')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager', 'attendant', 'professional')
  );

-- 7. Tabela de Reservas Avulsas / Drop-in / Pacotes (Class Reservations)
CREATE TABLE public.class_reservations (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  class_group_id text NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  student_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'dropin' CHECK (kind IN ('dropin', 'trial', 'package')),
  charge_id text,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'canceled')),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reservations_org ON public.class_reservations(organization_id);
CREATE INDEX idx_reservations_session ON public.class_reservations(organization_id, session_id);
CREATE INDEX idx_reservations_student ON public.class_reservations(organization_id, student_id);
CREATE INDEX idx_reservations_class ON public.class_reservations(organization_id, class_group_id);

CREATE TRIGGER trg_class_reservations_updated_at
  BEFORE UPDATE ON public.class_reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.class_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY reservations_select_own ON public.class_reservations
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY reservations_manage_own ON public.class_reservations
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager', 'attendant', 'professional')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager', 'attendant', 'professional')
  );

-- 8. Tabela de Substituições de Professor por Aula (Class Session Overrides)
CREATE TABLE public.class_session_overrides (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  instructor_id text REFERENCES public.professionals(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, session_id)
);

CREATE INDEX idx_session_overrides_org_session ON public.class_session_overrides(organization_id, session_id);

CREATE TRIGGER trg_session_overrides_updated_at
  BEFORE UPDATE ON public.class_session_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.class_session_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY session_overrides_select_own ON public.class_session_overrides
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY session_overrides_manage_own ON public.class_session_overrides
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager', 'professional')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager', 'professional')
  );
