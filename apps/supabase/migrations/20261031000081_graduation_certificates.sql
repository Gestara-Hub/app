-- =============================================================================
-- Migration: 20261031000081_graduation_certificates.sql
-- Description: certificado de graduacao (doc product/21 §1.6). Segundo tipo de
--   certificado, emitido pelo registro de graduacao do aluno (faixa, nivel,
--   modulo ou fase), com modelo proprio do espaco e, opcionalmente, da
--   modalidade. A emissao usa a mesma tabela issued_certificates, com `kind` e
--   `promotion_id` (id do registro no historico do aluno) no lugar da matricula.
--   Gravado pelo servidor (apply_world_changes), como o resto.
-- =============================================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS graduation_certificate_template jsonb;
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS graduation_certificate_template jsonb;

-- A coluna nova entra na lista de leitura do usuario logado (migracao 69).
GRANT SELECT (graduation_certificate_template) ON public.organizations TO authenticated;

ALTER TABLE public.issued_certificates
  ALTER COLUMN enrollment_id DROP NOT NULL,
  ALTER COLUMN class_group_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'course' CHECK (kind IN ('course', 'graduation')),
  ADD COLUMN IF NOT EXISTS promotion_id text,
  ADD COLUMN IF NOT EXISTS modality_id text REFERENCES public.categories(id) ON DELETE SET NULL;

-- Curso: matricula e turma; graduacao: o registro do historico. Um certificado por registro.
ALTER TABLE public.issued_certificates
  ADD CONSTRAINT chk_issued_certificates_source CHECK (
    (kind = 'course' AND enrollment_id IS NOT NULL AND class_group_id IS NOT NULL)
    OR (kind = 'graduation' AND promotion_id IS NOT NULL)
  );
CREATE UNIQUE INDEX IF NOT EXISTS uq_issued_certificates_promotion
  ON public.issued_certificates(organization_id, promotion_id)
  WHERE promotion_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_issued_certificates_student
  ON public.issued_certificates(organization_id, student_id);
