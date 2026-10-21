-- Migration: 20261021000021_online_payment_paid_method.
-- Meio que o aluno usou de fato (o link aceita credito ou debito). Vem do
-- billingType do webhook do Asaas; junto com o netValue, troca a tarifa
-- estimada pela real (doc 19, secao 4).
alter table public.online_payments
  add column if not exists paid_method text
    check (paid_method is null or paid_method in ('pix', 'boleto', 'creditCard', 'debitCard'));
