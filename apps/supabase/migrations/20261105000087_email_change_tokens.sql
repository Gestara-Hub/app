-- Migration: 20261105000087_email_change_tokens.
-- Troca do e-mail de acesso pela propria pessoa (05/11/2026): ela pede com a
-- senha atual, o e-mail novo recebe um link de 1 hora e a troca so vale ao
-- confirmar; o e-mail antigo recebe um aviso. Como em password_reset_tokens,
-- so o hash do token fica no banco e so o servidor acessa.

create table if not exists public.email_change_tokens (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  old_email text not null,
  new_email text not null,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'consumed', 'revoked')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_email_change_tokens_user_status
  on public.email_change_tokens(auth_user_id, status);

drop trigger if exists trg_email_change_tokens_updated_at on public.email_change_tokens;
create trigger trg_email_change_tokens_updated_at
  before update on public.email_change_tokens
  for each row execute function public.set_updated_at();

alter table public.email_change_tokens enable row level security;
-- Sem politicas: acessada so pela chave de servico no servidor.
revoke all on public.email_change_tokens from anon, authenticated;
