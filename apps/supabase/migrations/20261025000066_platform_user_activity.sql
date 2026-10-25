-- =============================================================================
-- Migration: 20261025000066_platform_user_activity.sql
-- Description: Linha do tempo de uma pessoa no painel admin (doc technical/21 e 26):
--   o que ela fez no sistema perto de um erro ou relato. A Auditoria do espaco
--   guarda rotulos com nome de aluno ("mensalidade de Fulano"), entao o painel
--   NAO le a tabela: le esta visao, que expoe so quem, quando, o tipo da acao e
--   do alvo, se falhou e o codigo do erro. Nada de rotulo, resumo ou alteracoes.
--   Executa como dono (mesmo padrao das visoes `platform.space_*`).
-- =============================================================================

CREATE OR REPLACE VIEW platform.user_activity AS
SELECT a.organization_id,
       a.actor ->> 'userId' AS user_id,
       a."timestamp" AS occurred_at,
       a.action,
       a.target ->> 'type' AS target_type,
       a.failed,
       a.error_reference,
       a.security
  FROM public.audit_logs a
 WHERE a.actor ->> 'userId' IS NOT NULL
   AND a.actor ->> 'userId' <> 'system';

GRANT SELECT ON platform.user_activity TO platform_app;
