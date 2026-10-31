-- =============================================================================
-- Migration: 20261031000069_security_hardening.sql
-- Description: auditoria de seguranca da noite de 30/10/2026 (diario em
--   docs/handoff/2026-10-31-diario-noturno.md). O app grava pelo servidor
--   (chave de servico, depois de conferir sessao e permissao); o navegador nao
--   precisa ler segredo nem gravar direto nestas tabelas pelo PostgREST, e
--   quem tem a sessao (o token fica no cookie do Supabase) conseguia.
--   1. organizations: a chave do Asaas (gateway_api_key) sai do alcance de
--      anon e authenticated (leitura por coluna). Antes, qualquer membro, ate
--      professor, lia a chave e movia o dinheiro do espaco. A escrita direta
--      sai: dono e gerente gravavam o plano pago, a situacao do espaco e a
--      carteira do repasse. So o servidor grava.
--   2. online_payments: so leitura; um gerente inseria um Pix proprio que
--      aparecia na pagina oficial de pagamento.
--   3. user_preferences: a politica aberta a todos (inclusive sem login) sai;
--      o servidor le e grava pelo usuario da sessao do Supabase.
--   4. legal_consents: membro nao insere prova de consentimento direto.
--   5. Matriculas, presencas, lista de espera, reservas e substituicoes: a
--      escrita direta sai (professor e atendente apagavam qualquer matricula
--      do espaco). O app grava por apply_world_changes, so do servidor.
--   6. Limite de tentativas: check_rate_limit e reset_rate_limit so pelo
--      servidor (sem login, zerava o limite do login e do codigo de acesso).
--   7. Funcoes que gravam cobranca, lancamento, uso de pacote e categorias
--      padrao: so o servidor (e os gatilhos, que rodam como dono).
-- =============================================================================

-- 1. organizations -------------------------------------------------------------
REVOKE ALL ON public.organizations FROM anon;
REVOKE ALL ON public.organizations FROM authenticated;
GRANT SELECT (
  id, name, segment, model, class_segment, custom_segment_name, custom_segment_progression,
  custom_segment_billing, settings, subscription, status, created_at, updated_at,
  gateway_provider, gateway_account_id, gateway_wallet_id, gateway_status, gateway_fees,
  gateway_fees_synced_at, gateway_webhook_url, certificate_template
) ON public.organizations TO authenticated;
DROP POLICY IF EXISTS organizations_update_own ON public.organizations;

-- 2. online_payments -----------------------------------------------------------
DROP POLICY IF EXISTS online_payments_manage_own ON public.online_payments;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.online_payments FROM anon, authenticated;

-- 3. user_preferences ----------------------------------------------------------
DROP POLICY IF EXISTS "Acesso a preferencias de usuario" ON public.user_preferences;
REVOKE ALL ON public.user_preferences FROM anon, authenticated;

-- 4. legal_consents ------------------------------------------------------------
DROP POLICY IF EXISTS legal_consents_isolation_insert ON public.legal_consents;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.legal_consents FROM anon, authenticated;

-- 5. Turmas: escrita so pelo servidor ------------------------------------------
DROP POLICY IF EXISTS enrollments_manage_own ON public.enrollments;
DROP POLICY IF EXISTS attendances_manage_own ON public.attendances;
DROP POLICY IF EXISTS waitlist_manage_own ON public.waitlist;
DROP POLICY IF EXISTS reservations_manage_own ON public.class_reservations;
DROP POLICY IF EXISTS session_overrides_manage_own ON public.class_session_overrides;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.enrollments, public.attendances, public.waitlist, public.class_reservations, public.class_session_overrides
  FROM anon, authenticated;

-- 6. Limite de tentativas ------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_rate_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_rate_limit(text) TO service_role;

-- 7. Funcoes que gravam --------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.insert_membership_charges(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.insert_recurrence_entries(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_attendance_with_packages(text, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_organization_financial_categories(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_membership_charges(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_recurrence_entries(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_attendance_with_packages(text, text, text, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.seed_organization_financial_categories(text) TO service_role;
