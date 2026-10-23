-- Migration: 20261022000038_online_payment_credit_date.sql
-- Pago nao e o mesmo que disponivel (doc do Asaas): PAYMENT_CONFIRMED = pago,
-- saldo ainda nao liberado (cartao: cerca de 32 dias; debito: 3); PAYMENT_RECEIVED
-- = valor disponivel na conta. A tela de Recebimentos online separa "a liberar"
-- de "recebido" por estas duas colunas.
--  - credit_date: dia em que o valor fica (ou ficou) disponivel (estimatedCreditDate/creditDate);
--  - funds_released: o valor ja esta disponivel para saque.
alter table public.online_payments
  add column if not exists credit_date date,
  add column if not exists funds_released boolean not null default false;

-- Ja pagos: Pix e boleto liberam na hora; cartao fica a liberar pela estimativa.
update public.online_payments
set funds_released = coalesce(paid_method, 'pix') not in ('creditCard', 'debitCard'),
    credit_date = case
      when coalesce(paid_method, 'pix') = 'creditCard' then (paid_at at time zone 'America/Sao_Paulo')::date + 32
      when paid_method = 'debitCard' then (paid_at at time zone 'America/Sao_Paulo')::date + 3
      else (paid_at at time zone 'America/Sao_Paulo')::date
    end
where status = 'paid' and credit_date is null and paid_at is not null;
