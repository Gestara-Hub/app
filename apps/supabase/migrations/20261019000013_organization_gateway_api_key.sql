-- Migration: 20261019000013_organization_gateway_api_key.sql
-- Adiciona coluna de chave de API da subconta na organização

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS gateway_api_key text;
