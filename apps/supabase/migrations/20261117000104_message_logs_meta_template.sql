-- =============================================================================
-- Migration: 20261117000104_message_logs_meta_template.sql
-- Description: modelo aprovado da Meta usado no envio oficial (doc technical/07
--   §3.3). Mensagem que o espaco inicia (lembrete, boas-vindas, parabens) so
--   sai por modelo aprovado; o registro guarda o nome, o idioma e as variaveis
--   em ordem para a fila entregar e o "Reenviar" repetir igual. Sem ele, o
--   envio e texto livre (so na janela de 24 horas da ultima mensagem do aluno).
-- =============================================================================

ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS meta_template jsonb;
