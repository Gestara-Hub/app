-- Migration: 20261021000025_membership_charges_unique.
-- Mensalidades geradas automaticamente no servidor (doc 15, fatia 1). Antes a
-- geracao rodava no navegador de cada um e dois aparelhos podiam gravar a mesma
-- mensalidade com ids diferentes. Agora:
--  1. as duplicadas que ja existam sao canceladas pelo sistema (fica a mais antiga);
--  2. um indice unico impede duas mensalidades ativas do mesmo aluno no mesmo periodo;
--  3. insert_membership_charges insere em lote ignorando o que ja existe.

with ranked as (
  select id,
         row_number() over (
           partition by organization_id, student_id, period_start, period_end
           order by created_at, id
         ) as rn
  from public.charges
  where kind = 'membership'
    and status <> 'canceled'
    and period_start is not null
    and period_end is not null
)
update public.charges c
set status = 'canceled',
    canceled_by = 'system',
    notes = 'Mensalidade duplicada (geração automática)'
from ranked r
where c.id = r.id and r.rn > 1;

create unique index if not exists uq_charges_membership_period
  on public.charges (organization_id, student_id, period_start, period_end)
  where kind = 'membership' and status <> 'canceled';

create or replace function public.insert_membership_charges(
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
  -- Mesmo controle das outras funcoes: so o proprio espaco; o service role passa; anonimo nunca.
  if auth.uid() is null then
    if auth.role() is distinct from 'service_role' then
      raise exception 'é preciso estar autenticado' using errcode = '42501';
    end if;
  elsif public.current_organization_id() is distinct from p_organization_id then
    raise exception 'organização inválida' using errcode = '42501';
  end if;

  insert into public.charges (
    id, organization_id, unit_id, student_id, kind, plan_id, class_group_id, competence,
    period_start, period_end, due_date, amount_cents, status, scholarship_percent,
    list_amount_cents, cycle_index, cycle_total, is_prorated, prorated_days, notes
  )
  select
    coalesce(r.id, gen_random_uuid()::text),
    p_organization_id,
    r.unit_id,
    r.student_id,
    'membership',
    r.plan_id,
    r.class_group_id,
    r.competence,
    r.period_start,
    r.period_end,
    r.due_date,
    r.amount_cents,
    coalesce(r.status, 'pending'),
    r.scholarship_percent,
    r.list_amount_cents,
    r.cycle_index,
    r.cycle_total,
    coalesce(r.is_prorated, false),
    r.prorated_days,
    r.notes
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(
    id text, unit_id text, student_id text, plan_id text, class_group_id text, competence text,
    period_start date, period_end date, due_date date, amount_cents integer, status text,
    scholarship_percent integer, list_amount_cents integer, cycle_index integer, cycle_total integer,
    is_prorated boolean, prorated_days integer, notes text
  )
  on conflict (organization_id, student_id, period_start, period_end)
    where kind = 'membership' and status <> 'canceled'
  do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.insert_membership_charges(text, jsonb) from public, anon;
grant execute on function public.insert_membership_charges(text, jsonb) to authenticated, service_role;
