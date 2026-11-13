-- Migration: 20261113000099_event_graduation.sql
-- Evento de graduacao (doc product/30 §4, decidido em 13/11/2026): a opcao
-- "Conta para a graduacao" (nunca ligada a frequencia) vira "Evento de
-- graduacao", com o repasse opcional a federacao por aluno graduado.

ALTER TABLE public.events RENAME COLUMN counts_for_progression TO graduation;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS federation_fee_cents integer
    CHECK (federation_fee_cents IS NULL OR federation_fee_cents > 0);
