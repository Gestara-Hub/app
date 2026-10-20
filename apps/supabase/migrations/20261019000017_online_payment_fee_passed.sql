-- Adiciona suporte a identificação de repasse de taxas ao aluno
alter table public.online_payments
  add column if not exists fee_passed_to_customer boolean not null default false;
