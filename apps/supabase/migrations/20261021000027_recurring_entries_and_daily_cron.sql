-- Migration: 20261021000027_recurring_entries_and_daily_cron.
-- Recorrencias do Financeiro no servidor (doc 15, fatia 1), com o mesmo
-- tratamento das mensalidades (migracao 25), e o cron diario passa a chamar
-- uma rota unica de tarefas diarias.
--  1. lancamentos de recorrencia duplicados (mesma recorrencia e competencia)
--     sao cancelados, fica o mais antigo;
--  2. indice unico impede dois lancamentos ativos da mesma recorrencia no mes;
--  3. insert_recurrence_entries insere em lote ignorando o que ja existe;
--  4. o cron chama /api/cron/daily (mensalidades e recorrencias).

with ranked as (
  select id,
         row_number() over (
           partition by organization_id, recurrence_id, recurrence_competence
           order by created_at, id
         ) as rn
  from public.financial_entries
  where recurrence_id is not null
    and recurrence_competence is not null
    and status <> 'canceled'
)
update public.financial_entries e
set status = 'canceled',
    notes = 'Lançamento repetido duplicado (geração automática)'
from ranked r
where e.id = r.id and r.rn > 1;

create unique index if not exists uq_financial_entries_recurrence_competence
  on public.financial_entries (organization_id, recurrence_id, recurrence_competence)
  where recurrence_id is not null and status <> 'canceled';

create or replace function public.insert_recurrence_entries(
  p_organization_id text,
  p_rows jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    if auth.role() is distinct from 'service_role' then
      raise exception 'é preciso estar autenticado' using errcode = '42501';
    end if;
  elsif public.current_organization_id() is distinct from p_organization_id then
    raise exception 'organização inválida' using errcode = '42501';
  end if;

  insert into public.financial_entries (
    id, organization_id, unit_id, type, category_id, description, amount_cents,
    due_date, status, recurrence_id, recurrence_competence
  )
  select
    coalesce(r.id, gen_random_uuid()::text),
    p_organization_id,
    r.unit_id,
    r.type,
    r.category_id,
    r.description,
    r.amount_cents,
    r.due_date,
    'pending',
    r.recurrence_id,
    r.recurrence_competence
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(
    id text, unit_id text, type text, category_id text, description text, amount_cents integer,
    due_date date, recurrence_id text, recurrence_competence text
  )
  on conflict (organization_id, recurrence_id, recurrence_competence)
    where recurrence_id is not null and status <> 'canceled'
  do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.insert_recurrence_entries(text, jsonb) from public, anon;
grant execute on function public.insert_recurrence_entries(text, jsonb) to authenticated, service_role;

-- Cron: uma rota para as tarefas diarias.
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
    raise notice 'app_url ou cron_secret ausentes no Vault: tarefas diárias não chamadas.';
    return null;
  end if;

  select net.http_post(
    url := rtrim(v_url, '/') || '/api/cron/daily',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) into v_request;
  return v_request;
end;
$$;

revoke all on function public.run_membership_charges_cron() from public, anon, authenticated;
