-- Migration: 20261021000026_membership_charges_cron.
-- Geracao diaria das mensalidades (doc 15, fatia 1; doc 06 secao 2.1): o
-- Supabase Cron chama a rota /api/cron/membership-charges do app todo dia, para
-- as mensalidades nascerem mesmo sem ninguem abrir o app.
--
-- A URL do app e o segredo ficam no Vault, por ambiente (nunca no codigo):
--   select vault.create_secret('<url do app, sem barra no fim>', 'app_url');
--   select vault.create_secret('<mesmo valor de CRON_SECRET>', 'cron_secret');
-- Sem os dois, a funcao so avisa e nao chama nada.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.run_membership_charges_cron()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_secret text;
  v_request bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null then
    raise notice 'app_url ou cron_secret ausentes no Vault: geração de mensalidades não chamada.';
    return null;
  end if;

  select net.http_post(
    url := rtrim(v_url, '/') || '/api/cron/membership-charges',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) into v_request;
  return v_request;
end;
$$;

revoke all on function public.run_membership_charges_cron() from public, anon, authenticated;

-- Todo dia as 06:00 de Brasilia (09:00 UTC). Reagenda se ja existir.
select cron.unschedule(jobid) from cron.job where jobname = 'membership-charges-daily';
select cron.schedule('membership-charges-daily', '0 9 * * *', 'select public.run_membership_charges_cron()');
