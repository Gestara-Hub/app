-- =============================================================================
-- Migration: 20261031000073_student_measurements.sql
-- Description: testes e medidas dos alunos (fase B de 31/10/2026, doc
--   product/21 §2.4). A modalidade define as medidas (categories.measurements,
--   jsonb: enabled + measures[{id, name, unit, better}]); cada avaliacao e de
--   um aluno numa modalidade, com os valores por medida (values, jsonb).
--   Leitura: o proprio espaco. Escrita: so o servidor (chave de servico), como
--   as tabelas de turma depois da auditoria de 30/10/2026. Com a verificacao
--   em duas etapas exigida no banco (migracao 70).
-- =============================================================================

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS measurements jsonb;

CREATE TABLE IF NOT EXISTS public.student_measurements (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  modality_id text NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  date date NOT NULL,
  "values" jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_measurements_student
  ON public.student_measurements(organization_id, student_id, modality_id, date);

CREATE TRIGGER trg_student_measurements_updated_at
  BEFORE UPDATE ON public.student_measurements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.student_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_measurements_select_own ON public.student_measurements
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.student_measurements FROM anon, authenticated;

CREATE POLICY require_second_factor ON public.student_measurements AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.second_factor_ok())) WITH CHECK ((SELECT public.second_factor_ok()));
