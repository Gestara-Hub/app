-- Migration: 20261022000034_online_payments_expiry_cron.
-- Pix e links vencidos expiram de hora em hora, para todos os espacos, e sao
-- cancelados no Asaas (que aceita pagamento por ate 12 meses depois do
-- vencimento). Antes so expiravam quando alguem abria as telas de cobranca.
--  1. indice parcial: a rota busca numa consulta so os pagamentos em aberto
--     com a validade vencida, sem passar espaco por espaco;
--  2. cron por hora chamando /api/cron/online-payments;
--  3. o cron diario (mensalidades e recorrencias) passa a se chamar "daily".

create index if not exists idx_online_payments_awaiting_expiry
  on public.online_payments(expires_at)
  where status = 'awaiting';

create or replace function public.run_online_payments_cron()
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
    raise notice 'app_url ou cron_secret ausentes no Vault: expiração dos pagamentos online não chamada.';
    return null;
  end if;

  select net.http_post(
    url := rtrim(v_url, '/') || '/api/cron/online-payments',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) into v_request;
  return v_request;
end;
$$;

revoke all on function public.run_online_payments_cron() from public, anon, authenticated;

-- O agendamento antigo tinha o nome da primeira tarefa; a rota ja e a diaria.
select cron.unschedule(jobid) from cron.job where jobname = 'membership-charges-daily';
select cron.unschedule(jobid) from cron.job where jobname = 'daily';
select cron.schedule('daily', '0 9 * * *', 'select public.run_membership_charges_cron()');

select cron.unschedule(jobid) from cron.job where jobname = 'online-payments-expiry';
select cron.schedule('online-payments-expiry', '5 * * * *', 'select public.run_online_payments_cron()');
