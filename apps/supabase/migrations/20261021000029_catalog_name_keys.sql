-- =============================================================================
-- Migration: 20261021000029_catalog_name_keys.sql
-- Description: Doc 15, fatia 2.1. Nome unico por organizacao sem acento nem
--              caixa tambem nas modalidades (como a validacao da tela), com uma
--              funcao so (`name_key`) para cargos e modalidades.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.name_key(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT lower(extensions.unaccent('extensions.unaccent'::regdictionary, btrim(p_name)));
$$;

-- Cargos: troca o indice da migracao 28 para a funcao comum.
DROP INDEX IF EXISTS public.uq_roles_organization_name;
CREATE UNIQUE INDEX uq_roles_organization_name
  ON public.roles (organization_id, public.name_key(name));
DROP FUNCTION IF EXISTS public.role_name_key(text);

-- Modalidades: duplicadas por acento ou caixa ganham sufixo antes do indice.
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY organization_id, public.name_key(name) ORDER BY created_at, id
  ) AS rn
  FROM public.categories
)
UPDATE public.categories c
SET name = c.name || ' (' || ranked.rn || ')'
FROM ranked
WHERE ranked.id = c.id AND ranked.rn > 1;

DROP INDEX IF EXISTS public.uq_categories_org_name;
CREATE UNIQUE INDEX uq_categories_org_name
  ON public.categories (organization_id, public.name_key(name));
