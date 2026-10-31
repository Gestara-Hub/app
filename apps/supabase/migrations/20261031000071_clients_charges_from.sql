-- =============================================================================
-- Migration: 20261031000071_clients_charges_from.sql
-- Description: aluno antigo cadastrado agora sem os meses passados (decisao de
--   31/10/2026, pergunta "Cobrar os meses desde o inicio?" do cadastro). As
--   mensalidades que vencem antes de charges_from nao sao cobradas; vazio =
--   cobra desde o inicio do plano (plan_start_date).
-- =============================================================================

alter table public.clients add column if not exists charges_from date;
