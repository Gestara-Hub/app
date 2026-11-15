-- Migration: 20261114000101_expand_category_colors.sql
-- Expande a paleta de cores das modalidades de 8 para 14 tons (mantendo `violet`
-- exclusivo de Eventos). Preserva as cores ja salvas nas modalidades existentes.

DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
    FROM pg_constraint
   WHERE conrelid = 'public.categories'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%color%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.categories DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE public.categories
  ADD CONSTRAINT categories_color_check
    CHECK (
      color IS NULL
      OR color IN (
        'blue', 'emerald', 'amber', 'rose', 'cyan', 'orange', 'lime', 'stone',
        'indigo', 'teal', 'pink', 'red', 'sky', 'yellow'
      )
    );

CREATE OR REPLACE FUNCTION public.categories_pick_color()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  palette text[] := ARRAY[
    'blue', 'emerald', 'amber', 'rose', 'cyan', 'orange', 'lime', 'stone',
    'indigo', 'teal', 'pink', 'red', 'sky', 'yellow'
  ];
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
  NEW.color := palette[(total % array_length(palette, 1)) + 1];
  RETURN NEW;
END;
$$;
