-- =============================================================================
-- Migration: 20261104000084_attachments_4mb.sql
-- Description: teto de 4 MB por arquivo no bucket de anexos (era 10 MB). Na
--   Vercel a requisicao de envio aceita ate 4,5 MB de corpo; o app manda um
--   arquivo por requisicao e confere o mesmo teto no campo e na rota
--   (lib/files.ts, MAX_UPLOAD_BYTES). Arquivos ja guardados nao mudam.
-- =============================================================================

UPDATE storage.buckets
   SET file_size_limit = 4194304 -- 4 MB
 WHERE id = 'attachments';
