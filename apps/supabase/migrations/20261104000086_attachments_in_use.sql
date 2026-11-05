-- =============================================================================
-- Migration: 20261104000086_attachments_in_use.sql
-- Description: envio de arquivo resistente a falha (04/11/2026). O arquivo sobe
--   assim que e escolhido, antes de salvar o formulario; um anexo "em uso" e o
--   que algum registro aponta (sem marcacao que possa falhar):
--     comprovantes da cobranca, anexos do lancamento e do pagamento de
--     professor, arquivo do documento da ficha, logo e arte dos modelos de
--     certificado (do espaco e das modalidades, de conclusao e de graduacao).
--   Tirar o arquivo da lista antes de salvar apaga o anexo (so o do proprio
--   usuario e sem uso); a rotina diaria apaga os sem uso ha mais de 24 horas.
--   Novo registro que guardar anexo precisa entrar em attachment_is_used.
-- =============================================================================

ALTER TABLE public.attachments ADD COLUMN IF NOT EXISTS uploaded_by text;

CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_at ON public.attachments (uploaded_at);

CREATE OR REPLACE FUNCTION public.attachment_is_used(p_org text, p_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.charges c
             WHERE c.organization_id = p_org AND c.attachments @> jsonb_build_array(jsonb_build_object('id', p_id)))
    OR EXISTS (SELECT 1 FROM public.financial_entries e
                WHERE e.organization_id = p_org AND e.attachments @> jsonb_build_array(jsonb_build_object('id', p_id)))
    OR EXISTS (SELECT 1 FROM public.teacher_payouts t
                WHERE t.organization_id = p_org AND t.attachments @> jsonb_build_array(jsonb_build_object('id', p_id)))
    OR EXISTS (SELECT 1 FROM public.person_documents d
                WHERE d.organization_id = p_org AND d.file->>'id' = p_id)
    OR EXISTS (SELECT 1 FROM public.organizations o
                WHERE o.id = p_org AND p_id IN (
                  o.certificate_template->>'logoFileId', o.certificate_template->'artwork'->>'fileId',
                  o.graduation_certificate_template->>'logoFileId', o.graduation_certificate_template->'artwork'->>'fileId'))
    OR EXISTS (SELECT 1 FROM public.categories k
                WHERE k.organization_id = p_org AND p_id IN (
                  k.certificate_template->>'logoFileId', k.certificate_template->'artwork'->>'fileId',
                  k.graduation_certificate_template->>'logoFileId', k.graduation_certificate_template->'artwork'->>'fileId'));
$$;

-- Anexos sem uso enviados antes de p_older_than (a rotina apaga arquivo e linha).
CREATE OR REPLACE FUNCTION public.unused_attachments(p_older_than interval, p_limit integer DEFAULT 500)
RETURNS TABLE (id text, organization_id text, storage_path text)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT a.id, a.organization_id, a.storage_path
    FROM public.attachments a
   WHERE a.uploaded_at < now() - p_older_than
     AND NOT public.attachment_is_used(a.organization_id, a.id)
   ORDER BY a.uploaded_at
   LIMIT p_limit;
$$;

-- So o servidor (chave de servico) chama.
REVOKE ALL ON FUNCTION public.attachment_is_used(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unused_attachments(interval, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attachment_is_used(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.unused_attachments(interval, integer) TO service_role;
