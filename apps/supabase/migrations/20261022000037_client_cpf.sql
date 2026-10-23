-- Migration: 20261022000037_client_cpf.sql
-- CPF do aluno: o parceiro de pagamentos (Asaas) exige o CPF de quem paga para
-- criar a cobranca online. Aluno maior paga com o proprio CPF; menor de idade,
-- com o do responsavel financeiro (guardado em clients.guardians, jsonb, campos
-- "cpf" e "financial", sem coluna nova). So digitos, opcional.
alter table public.clients
  add column if not exists cpf text;

alter table public.clients
  drop constraint if exists clients_cpf_digits;
alter table public.clients
  add constraint clients_cpf_digits check (cpf is null or cpf ~ '^[0-9]{11}$');

comment on column public.clients.cpf is
  'CPF do aluno (11 digitos), usado como pagador da cobranca online quando maior de idade.';
