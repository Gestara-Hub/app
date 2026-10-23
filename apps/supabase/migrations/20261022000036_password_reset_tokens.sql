-- Migration: 20261022000036_password_reset_tokens.
-- "Esqueci minha senha" para quem tem senha (cadastro por e-mail ou convite):
-- o app manda pelo MailerSend um link de 1 hora para /reset-password. Quem
-- entra so pelo Google nao recebe link (entra direto pelo Google). Como em
-- signup_tokens, so o hash do token fica no banco e so o servidor acessa.

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'consumed', 'revoked')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_password_reset_tokens_user_status
  on public.password_reset_tokens(auth_user_id, status);

drop trigger if exists trg_password_reset_tokens_updated_at on public.password_reset_tokens;
create trigger trg_password_reset_tokens_updated_at
  before update on public.password_reset_tokens
  for each row execute function public.set_updated_at();

alter table public.password_reset_tokens enable row level security;
-- Sem politicas: acessada so pela chave de servico no servidor.
