-- =============================================================================
-- Migration: 20261023000044_audit_logs_no_session_insert.sql
-- Description: A sessao do usuario deixa de inserir em audit_logs. Antes, a
--   politica de insercao so conferia o espaco: quem estivesse logado podia
--   gravar, direto pelo cliente do Supabase no navegador, um evento com o
--   autor que quisesse. Agora todo evento entra pelo servidor com a chave de
--   servico: o motor (apply_world_changes) e a acao recordAuditLogInDb, que
--   tira autor, espaco e hora da sessao. Continua sem UPDATE e sem DELETE.
-- =============================================================================

DROP POLICY IF EXISTS audit_logs_isolation_insert ON public.audit_logs;
