-- Migration: 20261021000023_online_payment_methods.
-- Formas da cobranca online (21/10/2026): alem de Pix e link de cartao,
-- boleto e "o aluno escolhe" (billingType UNDEFINED no Asaas).
alter table public.online_payments drop constraint if exists online_payments_method_check;
alter table public.online_payments
  add constraint online_payments_method_check check (method in ('pix', 'link', 'boleto', 'choice'));
