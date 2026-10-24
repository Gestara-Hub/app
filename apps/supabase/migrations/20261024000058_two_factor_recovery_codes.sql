-- Migration: 20261024000058_two_factor_recovery_codes.
-- Codigos de recuperacao da verificacao em duas etapas (doc technical/17): 8
-- codigos de uso unico, para quem perde o aplicativo autenticador. Como nos
-- outros codigos (migracao 48): so o hash fica no banco, RLS ligado sem
-- politicas, acesso so pela chave de servico no servidor.

create table if not exists public.two_factor_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_two_factor_recovery_codes_user
  on public.two_factor_recovery_codes(auth_user_id) where used_at is null;

alter table public.two_factor_recovery_codes enable row level security;

-- Entrar com um codigo de recuperacao tambem prova o segundo fator da sessao.
alter table public.two_factor_sessions drop constraint if exists two_factor_sessions_method_check;
alter table public.two_factor_sessions
  add constraint two_factor_sessions_method_check check (method in ('email', 'device', 'recovery'));

-- Codigo por e-mail para gerar novos codigos de recuperacao.
alter table public.two_factor_email_codes drop constraint if exists two_factor_email_codes_purpose_check;
alter table public.two_factor_email_codes
  add constraint two_factor_email_codes_purpose_check check (purpose in ('login', 'enable', 'disable', 'recovery'));
