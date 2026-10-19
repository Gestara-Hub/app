-- Migration: 20261019000006_evolution_and_assessments.sql
-- Description: Fatia 5 — Evolução e Avaliações (Assessments, Notas e Desempenho Pedagógico)

-- =============================================================================
-- 1. Tabela de Avaliações das Turmas (Assessments)
-- =============================================================================
CREATE TABLE public.assessments (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  class_group_id text NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  modality_id text NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  name text NOT NULL,
  date date NOT NULL,
  weight numeric NOT NULL DEFAULT 1 CHECK (weight > 0),
  level_id text,
  grades jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assessments_org ON public.assessments(organization_id);
CREATE INDEX idx_assessments_class ON public.assessments(organization_id, class_group_id);
CREATE INDEX idx_assessments_modality ON public.assessments(organization_id, modality_id);
CREATE INDEX idx_assessments_date ON public.assessments(organization_id, date);

CREATE TRIGGER trg_assessments_updated_at
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY assessments_select_own ON public.assessments
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY assessments_manage_own ON public.assessments
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager', 'teacher')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager', 'teacher')
  );
