-- =============================================================================
-- Migration: 20261031000078_server_only_catalog_writes.sql
-- Description: revisao geral de 31/10/2026, decisao 5 (validada pelo dono).
--   Fecha a escrita direta que a migracao 76 deixou de fora: categorias,
--   cargos, equipe, planos, pacotes, anexos e pagamentos online. As actions
--   conferem a permissao e o espaco da sessao e gravam pelo servidor (chave de
--   servico), como as outras tabelas do espaco. Antes, o banco ja so aceitava
--   dono e gerente (anexos tambem atendente), mas quem tinha o token pulava a
--   validacao e a auditoria do app. As politicas de leitura continuam.
-- =============================================================================

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  public.categories,
  public.roles,
  public.professionals,
  public.plans,
  public.lesson_packages,
  public.attachments,
  public.online_payments
FROM anon, authenticated;
