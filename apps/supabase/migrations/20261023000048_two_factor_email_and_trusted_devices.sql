-- Migration: 20261023000048_two_factor_email_and_trusted_devices.
-- Verificacao em duas etapas, entrega 2 (doc technical/17): codigo por e-mail,
-- prova do segundo fator por sessao e "lembrar este dispositivo por 30 dias".
-- Como em password_reset_tokens (migracao 36): so o hash fica no banco, RLS
-- ligado sem politicas, acesso so pela chave de servico no servidor.

-- Codigo de 6 numeros enviado por e-mail (login, ligar e desligar).
create table if not exists public.two_factor_email_codes (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('login', 'enable', 'disable')),
  code_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'consumed', 'revoked')),
  attempts int not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_two_factor_email_codes_user_purpose_status
  on public.two_factor_email_codes(auth_user_id, purpose, status);

drop trigger if exists trg_two_factor_email_codes_updated_at on public.two_factor_email_codes;
create trigger trg_two_factor_email_codes_updated_at
  before update on public.two_factor_email_codes
  for each row execute function public.set_updated_at();

alter table public.two_factor_email_codes enable row level security;

-- Sessao do Supabase que ja passou pelo segundo fator feito por nos (codigo por
-- e-mail ou dispositivo lembrado). O app autenticador nao precisa: o proprio
-- Supabase sobe a sessao para AAL2.
create table if not exists public.two_factor_sessions (
  session_id uuid primary key,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  method text not null check (method in ('email', 'device')),
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_two_factor_sessions_user on public.two_factor_sessions(auth_user_id);

alter table public.two_factor_sessions enable row level security;

-- Dispositivo lembrado: o token fica num cookie httpOnly; aqui so o hash.
create table if not exists public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  label text not null default '',
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists idx_trusted_devices_user on public.trusted_devices(auth_user_id);

alter table public.trusted_devices enable row level security;
-- Sem politicas nas tres tabelas: acessadas so pela chave de servico no servidor.

-- Limpeza diaria: codigos vencidos ha mais de 1 dia, sessoes vencidas e
-- dispositivos vencidos ou esquecidos ha mais de 30 dias.
create or replace function public.prune_two_factor()
returns bigint
language sql
security definer
set search_path = public
as $$
  with codes as (
    delete from public.two_factor_email_codes where expires_at < now() - interval '1 day' returning 1
  ), sessions as (
    delete from public.two_factor_sessions where expires_at < now() returning 1
  ), devices as (
    delete from public.trusted_devices
    where expires_at < now() - interval '30 days' or revoked_at < now() - interval '30 days'
    returning 1
  )
  select (select count(*) from codes) + (select count(*) from sessions) + (select count(*) from devices);
$$;

revoke all on function public.prune_two_factor() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

-- Todo dia as 03:50 de Brasilia (06:50 UTC), depois das outras limpezas. Reagenda se ja existir.
select cron.unschedule(jobid) from cron.job where jobname = 'two-factor-prune-daily';
select cron.schedule('two-factor-prune-daily', '50 6 * * *', 'select public.prune_two_factor()');
