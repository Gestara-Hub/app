-- =============================================================================
-- Migration: 20261117000105_message_templates_meta.sql
-- Description: modelo de cada gatilho na conta do WhatsApp do espaco (doc
--   technical/07 §1.4). Guarda o id do modelo na Meta (para editar), o texto
--   enviado a ela (o envio usa o mesmo texto), a situacao (APPROVED, PENDING,
--   REJECTED, PAUSED, DISABLED) e o motivo da recusa. O webhook da Meta grava
--   a situacao direto aqui.
-- =============================================================================

ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS meta_template_name text,
  ADD COLUMN IF NOT EXISTS meta_template_id text,
  ADD COLUMN IF NOT EXISTS meta_body text,
  ADD COLUMN IF NOT EXISTS meta_status text,
  ADD COLUMN IF NOT EXISTS meta_rejection_reason text;
