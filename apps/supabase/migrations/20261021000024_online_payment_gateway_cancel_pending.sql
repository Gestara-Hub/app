-- Migration: 20261021000024_online_payment_gateway_cancel_pending.
-- Cobranca online cancelada no GestaraHub mas nao no Asaas (falha na chamada):
-- fica marcada para tentar de novo, para o aluno nao pagar um link antigo.
alter table public.online_payments
  add column if not exists gateway_cancel_pending boolean not null default false;

create index if not exists idx_online_payments_cancel_pending
  on public.online_payments(organization_id)
  where gateway_cancel_pending;
