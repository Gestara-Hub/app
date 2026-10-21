-- Migration: 20261021000020_online_payment_gateway_fee.
-- Tarifa do provedor (Asaas) por cobranca online, separada do split do
-- GestaraHub (doc 19, secao 4, decisao A de 21/10/2026). No link o valor e a
-- pior estimativa entre os meios da fatura ate o pagamento.
alter table public.online_payments
  add column if not exists gateway_fee_cents integer not null default 0;
