import "server-only";
import { SUBSCRIPTION_PRICES } from "@gestarahub/core/subscription-prices";
import { sql } from "./db";

/**
 * Receita e ativacao (doc technical/26, fase 7): assinantes, MRR, movimento do
 * mes, taxa dos pagamentos online, funil e retencao. So agregados.
 */
export interface Subscribers {
  tier: "pro" | "scale";
  interval: "monthly" | "yearly";
  count: number;
  mrrCents: number;
}

/** Receita mensal recorrente: mensal = preco do mes; anual = preco/12. Cortesia nao conta. */
export async function subscribers(): Promise<{ rows: Subscribers[]; mrrCents: number; courtesy: number; payingTotal: number }> {
  const rows = await sql()<{ tier: string; interval: string; paying: number; courtesy: number }[]>`
    select subscription->>'tier' as tier, coalesce(subscription->>'interval', 'monthly') as interval,
           count(*) filter (where not (subscription ? 'courtesyUntil'))::int as paying,
           count(*) filter (where subscription ? 'courtesyUntil')::int as courtesy
      from public.organizations
     where coalesce(subscription->>'tier', 'free') <> 'free' and status = 'active'
     group by 1, 2`;
  const out: Subscribers[] = [];
  let courtesy = 0;
  for (const r of rows) {
    courtesy += r.courtesy;
    if (r.tier !== "pro" && r.tier !== "scale") continue;
    const interval = r.interval === "yearly" ? "yearly" : "monthly";
    const price = SUBSCRIPTION_PRICES[r.tier][interval].priceCents;
    out.push({ tier: r.tier, interval, count: r.paying, mrrCents: Math.round(((interval === "yearly" ? price / 12 : price) * r.paying)) });
  }
  return { rows: out, mrrCents: out.reduce((s, r) => s + r.mrrCents, 0), courtesy, payingTotal: out.reduce((s, r) => s + r.count, 0) };
}

export interface MonthMovement {
  month: string;
  created: number;
  activated: number;
  upgraded: number;
  downgraded: number;
  canceled: number;
  revertedToFree: number;
  onlineCount: number;
  onlineVolumeCents: number;
  feeCents: number;
}

/** Ultimos 6 meses (de Brasilia), do mais novo para o mais antigo. */
export async function movement(): Promise<MonthMovement[]> {
  const rows = await sql()<
    {
      month: string;
      created: number;
      activated: number;
      upgraded: number;
      downgraded: number;
      canceled: number;
      reverted: number;
      online_count: number;
      online_volume: string;
      fee: string;
    }[]
  >`
    with months as (
      select to_char((now() at time zone 'America/Sao_Paulo') - (n || ' months')::interval, 'YYYY-MM') as month from generate_series(0, 5) n
    ), ev as (
      select to_char(created_at at time zone 'America/Sao_Paulo', 'YYYY-MM') as month, kind, count(*)::int as n
        from public.subscription_events
       group by 1, 2
    )
    select m.month,
           coalesce((select created from platform.spaces_created_monthly c where c.month = m.month), 0) as created,
           coalesce((select n from ev where ev.month = m.month and kind = 'activated'), 0) as activated,
           coalesce((select n from ev where ev.month = m.month and kind = 'upgraded'), 0) as upgraded,
           coalesce((select n from ev where ev.month = m.month and kind = 'downgraded'), 0) as downgraded,
           coalesce((select n from ev where ev.month = m.month and kind = 'canceled'), 0) as canceled,
           coalesce((select n from ev where ev.month = m.month and kind = 'reverted_to_free'), 0) as reverted,
           coalesce((select paid_count from platform.online_revenue_monthly o where o.month = m.month), 0) as online_count,
           coalesce((select volume_cents from platform.online_revenue_monthly o where o.month = m.month), 0) as online_volume,
           coalesce((select fee_cents from platform.online_revenue_monthly o where o.month = m.month), 0) as fee
      from months m order by m.month desc`;
  return rows.map((r) => ({
    month: r.month,
    created: r.created,
    activated: r.activated,
    upgraded: r.upgraded,
    downgraded: r.downgraded,
    canceled: r.canceled,
    revertedToFree: r.reverted,
    onlineCount: r.online_count,
    onlineVolumeCents: Number(r.online_volume),
    feeCents: Number(r.fee),
  }));
}

export interface Funnel {
  spacesTotal: number;
  withStudents: number;
  withClasses: number;
  withCharges: number;
  withOnlinePaid: number;
  paying: number;
  active30d: number;
  payingActive30d: number;
}

export async function funnel(): Promise<Funnel> {
  const [r] = await sql()<
    { spaces_total: number; with_students: number; with_classes: number; with_charges: number; with_online_paid: number; paying: number; active_30d: number; paying_active_30d: number }[]
  >`select * from platform.revenue_funnel`;
  return {
    spacesTotal: r.spaces_total,
    withStudents: r.with_students,
    withClasses: r.with_classes,
    withCharges: r.with_charges,
    withOnlinePaid: r.with_online_paid,
    paying: r.paying,
    active30d: r.active_30d,
    payingActive30d: r.paying_active_30d,
  };
}
