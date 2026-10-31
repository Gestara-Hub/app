-- =============================================================================
-- Migration: 20261031000072_assessments_points_and_recovery.sql
-- Description: notas, fase A (31/10/2026, doc product/21 §2.3).
--   points: na soma dos pontos, quanto a avaliacao vale (parte do total da
--   escala); vazio na media com pesos e na recuperacao.
--   recovery_of: a avaliacao que esta recupera (vale a maior nota de cada
--   aluno); excluir a recuperada leva a recuperacao junto.
--   A configuracao da modalidade (resultMode, minAttendancePercent) fica no
--   jsonb categories.assessments, sem coluna nova.
-- =============================================================================

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS points numeric CHECK (points IS NULL OR points > 0),
  ADD COLUMN IF NOT EXISTS recovery_of text REFERENCES public.assessments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_assessments_recovery
  ON public.assessments(recovery_of)
  WHERE recovery_of IS NOT NULL;
