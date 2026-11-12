-- Migration: 20261112000096_whatsapp_consent.sql
-- Autorizacao para mensagens pelo WhatsApp do espaco (doc product/27, M1 e M2;
-- Politica de Mensagens do WhatsApp Business: opt-in do destinatario antes de
-- mensagem iniciada pela empresa, e opt-out ao responder "SAIR").
--   unknown: sem registro (o envio oficial automatico nao sai; o assistido sim)
--   granted: autorizado (data e quem registrou)
--   revoked: pediu para parar (no cadastro ou respondendo "SAIR")
-- O servidor carimba data e autor; o webhook grava a revogacao com a chave de servico.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS whatsapp_consent_status text NOT NULL DEFAULT 'unknown'
    CHECK (whatsapp_consent_status IN ('unknown', 'granted', 'revoked')),
  ADD COLUMN IF NOT EXISTS whatsapp_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_by text;
