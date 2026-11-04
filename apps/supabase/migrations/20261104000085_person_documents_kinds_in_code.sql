-- =============================================================================
-- Migration: 20261104000085_person_documents_kinds_in_code.sql
-- Description: os tipos de documento da ficha passam a ter uma fonte so, a
--   lista do codigo (packages/core/src/person-documents.ts). Sai a regra do
--   banco que listava os tipos: acrescentar um tipo vira uma linha na lista,
--   sem migracao; tirar um tipo e marca-lo como aposentado. A tabela continua
--   sem gravacao direta do usuario (migracao 83): todo documento passa pelo
--   servidor, que confere o tipo. Formato do codigo: letras minusculas e "_".
-- =============================================================================

ALTER TABLE public.person_documents DROP CONSTRAINT IF EXISTS person_documents_kind_check;
ALTER TABLE public.person_documents
  ADD CONSTRAINT person_documents_kind_format CHECK (kind ~ '^[a-z][a-z_]{1,48}$');
