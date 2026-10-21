-- Migration: 20261021000022_organization_gateway_fees_and_webhook.
-- Tarifas da subconta do espaco no Asaas (GET /myAccount/fees), guardadas cruas
-- com a promocao e a data de fim; atualizadas a cada 24 horas no uso e quando o
-- pagamento real diverge (doc 19, secao 4). A conta principal nao e guardada.
-- `gateway_webhook_url`: URL do webhook cadastrado na subconta, para recadastrar
-- quando ASAAS_WEBHOOK_URL mudar (tunel local, troca de dominio).
alter table public.organizations
  add column if not exists gateway_fees jsonb,
  add column if not exists gateway_fees_synced_at timestamptz,
  add column if not exists gateway_webhook_url text;
