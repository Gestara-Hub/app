-- Migration: 20261019000011_add_professional_email.sql
-- Adiciona o campo email (opcional) na tabela de profissionais

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS email text;

CREATE INDEX IF NOT EXISTS idx_professionals_email
  ON public.professionals(organization_id, email);
