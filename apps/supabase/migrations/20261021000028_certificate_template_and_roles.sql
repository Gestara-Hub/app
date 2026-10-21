-- =============================================================================
-- Migration: 20261021000028_certificate_template_and_roles.sql
-- Description: Doc 15, fatia 1. Modelo do certificado na organizacao (a logo ja
--              vai para o bucket privado `attachments`; o modelo guarda so o id)
--              e nome de cargo unico por organizacao.
-- =============================================================================

-- 1. Modelo do certificado: null = modelo padrao (nunca salvo).
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS certificate_template jsonb;

-- 2. Cargos: nome unico por organizacao, sem acento nem caixa. Duplicadas que
--    existirem ganham um sufixo antes do indice.
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.role_name_key(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT lower(extensions.unaccent('extensions.unaccent'::regdictionary, btrim(p_name)));
$$;

WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY organization_id, public.role_name_key(name) ORDER BY created_at, id
  ) AS rn
  FROM public.roles
)
UPDATE public.roles r
SET name = r.name || ' (' || ranked.rn || ')'
FROM ranked
WHERE ranked.id = r.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_organization_name
  ON public.roles (organization_id, public.role_name_key(name));
