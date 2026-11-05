-- =============================================================================
-- Migration: 20261105000089_users_one_active_per_professional.sql
-- Description: Um instrutor (professional) tem no maximo um usuario ATIVO ligado
--   (05/11/2026). Vale para todo caminho: criar, convidar, vincular e reativar
--   um usuario inativo (o servidor da a mensagem; o indice e a garantia final).
--   Usuario inativo nao conta: ao reativar, se o instrutor ja foi ligado a outro
--   usuario ativo, a reativacao e recusada. Um usuario so tem um instrutor
--   (users.professional_id), entao "dois instrutores para um usuario" nao existe.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.users
     WHERE professional_id IS NOT NULL AND status = 'active'
     GROUP BY organization_id, professional_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Há instrutores com mais de um usuário ativo. Inative os usuários a mais antes desta migração.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_active_professional
  ON public.users (organization_id, professional_id)
  WHERE professional_id IS NOT NULL AND status = 'active';
