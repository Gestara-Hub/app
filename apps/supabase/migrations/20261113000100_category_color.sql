-- Migration: 20261113000100_category_color.sql
-- Cor da modalidade no Calendario, versao 2 (doc product/29 §Calendario,
-- 13/11/2026): a cor passa a ser guardada na modalidade e escolhida no
-- formulario. As que ja existem ficam com a cor que mostravam (pela ordem de
-- criacao no espaco); as novas ganham a primeira cor livre.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS color text
    CHECK (color IS NULL OR color IN ('blue', 'emerald', 'amber', 'rose', 'cyan', 'orange', 'lime', 'stone'));

-- As que ja existem: a mesma cor da versao 1 (ordem de criacao, a paleta repete a cada 8).
WITH ordered AS (
  SELECT id,
         (row_number() OVER (PARTITION BY organization_id ORDER BY created_at, id) - 1) % 8 AS idx
    FROM public.categories
)
UPDATE public.categories c
   SET color = (ARRAY['blue', 'emerald', 'amber', 'rose', 'cyan', 'orange', 'lime', 'stone'])[o.idx + 1]
  FROM ordered o
 WHERE o.id = c.id
   AND c.color IS NULL;

-- Nova sem cor (assistente da configuracao inicial, criacao sem escolher):
-- a primeira cor que nenhuma do espaco usa; todas usadas, segue a ordem.
CREATE OR REPLACE FUNCTION public.categories_pick_color()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  palette text[] := ARRAY['blue', 'emerald', 'amber', 'rose', 'cyan', 'orange', 'lime', 'stone'];
  candidate text;
  total integer;
BEGIN
  IF NEW.color IS NOT NULL THEN
    RETURN NEW;
  END IF;
  FOREACH candidate IN ARRAY palette LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.categories
       WHERE organization_id = NEW.organization_id AND color = candidate
    ) THEN
      NEW.color := candidate;
      RETURN NEW;
    END IF;
  END LOOP;
  SELECT count(*) INTO total FROM public.categories WHERE organization_id = NEW.organization_id;
  NEW.color := palette[(total % 8) + 1];
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_categories_pick_color ON public.categories;
CREATE TRIGGER trg_categories_pick_color
  BEFORE INSERT ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.categories_pick_color();
