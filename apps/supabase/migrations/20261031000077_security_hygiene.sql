-- =============================================================================
-- Migration: 20261031000077_security_hygiene.sql
-- Description: revisao geral de 31/10/2026 (achado S13, higiene).
--   1. Arquivos: a politica do bucket attachments aceitava o espaco 'system',
--      que nenhum usuario tem (sem efeito hoje, mas uma porta a menos).
--   2. Funcoes SECURITY DEFINER sem search_path fixo: com search_path do
--      chamador, um objeto com o mesmo nome em outro schema poderia ser usado.
-- =============================================================================

DROP POLICY IF EXISTS attachments_objects_manage ON storage.objects;
CREATE POLICY attachments_objects_manage ON storage.objects
  TO authenticated
  USING (bucket_id = 'attachments' AND path_tokens[1] = public.current_organization_id())
  WITH CHECK (bucket_id = 'attachments' AND path_tokens[1] = public.current_organization_id());

ALTER FUNCTION public.trg_seed_financial_categories() SET search_path = public;
ALTER FUNCTION public.seed_organization_financial_categories(text) SET search_path = public;
