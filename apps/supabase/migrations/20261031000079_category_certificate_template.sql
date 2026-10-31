-- =============================================================================
-- Migration: 20261031000079_category_certificate_template.sql
-- Description: modelo de certificado por modalidade (doc product/21 §1).
--   O espaco segue com o modelo em organizations.certificate_template; uma
--   modalidade pode ter o proprio (categories.certificate_template), usado nos
--   cursos dela. Nulo = usa o do espaco. Gravado pelo servidor
--   (apply_world_changes), como o resto da modalidade.
-- =============================================================================

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS certificate_template jsonb;
