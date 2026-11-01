-- Migration: 20261101000082_online_fees_category.sql
-- Description: Categoria de sistema "Taxas de pagamento online" (despesa). As taxas
-- do pagamento online que ficam com o espaco saem do caixa numa linha propria
-- (decidido em 01/11/2026: a cobranca entra cheia, a taxa sai).

ALTER TABLE public.financial_categories DROP CONSTRAINT IF EXISTS financial_categories_system_key_check;
ALTER TABLE public.financial_categories
  ADD CONSTRAINT financial_categories_system_key_check
  CHECK (system_key IS NULL OR system_key IN ('memberships', 'dropins', 'extras', 'courses', 'packages', 'teachers', 'online_fees'));

CREATE OR REPLACE FUNCTION public.seed_organization_financial_categories(org_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.financial_categories (id, organization_id, type, name, system, system_key)
  VALUES
    ('fcat-' || org_id || '-memberships', org_id, 'income', 'Mensalidades', true, 'memberships'),
    ('fcat-' || org_id || '-dropins', org_id, 'income', 'Aulas avulsas', true, 'dropins'),
    ('fcat-' || org_id || '-extras', org_id, 'income', 'Cobranças avulsas', true, 'extras'),
    ('fcat-' || org_id || '-courses', org_id, 'income', 'Cursos', true, 'courses'),
    ('fcat-' || org_id || '-packages', org_id, 'income', 'Pacotes de aulas', true, 'packages'),
    ('fcat-' || org_id || '-products', org_id, 'income', 'Venda de produtos', false, null),
    ('fcat-' || org_id || '-events', org_id, 'income', 'Eventos e seminários', false, null),
    ('fcat-' || org_id || '-graduation', org_id, 'income', 'Taxa de graduação', false, null),
    ('fcat-' || org_id || '-other-income', org_id, 'income', 'Outras receitas', false, null),
    ('fcat-' || org_id || '-teachers', org_id, 'expense', 'Professores', true, 'teachers'),
    ('fcat-' || org_id || '-online_fees', org_id, 'expense', 'Taxas de pagamento online', true, 'online_fees'),
    ('fcat-' || org_id || '-rent', org_id, 'expense', 'Aluguel', false, null),
    ('fcat-' || org_id || '-utilities', org_id, 'expense', 'Contas (luz, água, internet)', false, null),
    ('fcat-' || org_id || '-equipment', org_id, 'expense', 'Material e equipamentos', false, null),
    ('fcat-' || org_id || '-marketing', org_id, 'expense', 'Marketing', false, null),
    ('fcat-' || org_id || '-taxes', org_id, 'expense', 'Impostos e taxas', false, null),
    ('fcat-' || org_id || '-other-expense', org_id, 'expense', 'Outras despesas', false, null)
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- Espacos que ja tem as categorias padrao ganham a nova (mesmo criterio das
-- migracoes v33 a v35 do mock: so quem ja tem as categorias).
INSERT INTO public.financial_categories (id, organization_id, type, name, system, system_key)
SELECT 'fcat-' || o.id || '-online_fees', o.id, 'expense', 'Taxas de pagamento online', true, 'online_fees'
FROM public.organizations o
WHERE EXISTS (SELECT 1 FROM public.financial_categories c WHERE c.organization_id = o.id)
ON CONFLICT (id) DO NOTHING;
