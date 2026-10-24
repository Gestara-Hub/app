import "server-only";
import { sql } from "./db";
import { requestInfo } from "./request";

/**
 * Planos pelo painel (doc technical/26, fase 3). Cada acao e uma funcao do banco
 * (`platform.*`, so o papel do painel executa) que valida, grava o plano, o
 * historico, a Auditoria do espaco e a auditoria do painel na mesma transacao.
 * Aqui so se chama a funcao e traduz o erro para a pessoa.
 */
export class PlanActionError extends Error {}

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const pg = error as { code?: string; message?: string };
    // 22023: regra de negocio; P0002: espaco nao existe. O texto ja vem em portugues.
    if (pg.code === "22023" || pg.code === "P0002") throw new PlanActionError(pg.message ?? "Não foi possível concluir.");
    throw error;
  }
}

export interface Actor {
  id: string;
  name: string;
}

export async function grantCourtesy(input: { organizationId: string; tier: "pro" | "scale"; days: number; reason: string; admin: Actor }): Promise<string> {
  const { ip, userAgent } = await requestInfo();
  return call(async () => {
    const [row] = await sql()<{ ends: string }[]>`
      select platform.grant_courtesy(${input.organizationId}, ${input.tier}, ${input.days}, ${input.reason}, ${input.admin.id}, ${input.admin.name}, ${ip}, ${userAgent})::text as ends`;
    return row.ends;
  });
}

export async function revokeCourtesy(input: { organizationId: string; reason: string; admin: Actor }): Promise<void> {
  const { ip, userAgent } = await requestInfo();
  await call(() => sql()`select platform.revoke_courtesy(${input.organizationId}, ${input.reason}, ${input.admin.id}, ${input.admin.name}, ${ip}, ${userAgent})`);
}

export async function extendGrace(input: { organizationId: string; days: number; reason: string; admin: Actor }): Promise<string> {
  const { ip, userAgent } = await requestInfo();
  return call(async () => {
    const [row] = await sql()<{ renews: string }[]>`
      select platform.extend_grace(${input.organizationId}, ${input.days}, ${input.reason}, ${input.admin.id}, ${input.admin.name}, ${ip}, ${userAgent})::text as renews`;
    return row.renews;
  });
}

export async function forceFree(input: { organizationId: string; partnerCanceled: boolean; reason: string; admin: Actor }): Promise<void> {
  const { ip, userAgent } = await requestInfo();
  await call(
    () => sql()`select platform.force_free(${input.organizationId}, ${input.partnerCanceled}, ${input.reason}, ${input.admin.id}, ${input.admin.name}, ${ip}, ${userAgent})`,
  );
}

export interface GrantRow {
  id: string;
  organizationId: string;
  organizationName: string;
  kind: "courtesy" | "grace" | "forced_free";
  tier: string | null;
  startsOn: string;
  endsOn: string | null;
  days: number | null;
  reason: string;
  grantedByName: string | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export async function listGrants(input: { organizationId?: string; activeOnly?: boolean; limit?: number }): Promise<GrantRow[]> {
  const rows = await sql()<
    {
      id: string; organization_id: string; organization_name: string; kind: GrantRow["kind"]; tier: string | null; starts_on: string; ends_on: string | null;
      days: number | null; reason: string; granted_by_name: string | null; revoked_at: Date | null; created_at: Date;
    }[]
  >`
    select g.id, g.organization_id, o.name as organization_name, g.kind, g.tier, g.starts_on::text, g.ends_on::text, g.days, g.reason,
           g.granted_by_name, g.revoked_at, g.created_at
      from platform.plan_grants g join public.organizations o on o.id = g.organization_id
     where (${input.organizationId ?? null}::text is null or g.organization_id = ${input.organizationId ?? null})
       and (${input.activeOnly ?? false} = false or (g.kind = 'courtesy' and g.revoked_at is null and g.ends_on >= platform.brasilia_today()))
     order by g.created_at desc
     limit ${input.limit ?? 50}`;
  return rows.map((r) => ({
    id: r.id, organizationId: r.organization_id, organizationName: r.organization_name, kind: r.kind, tier: r.tier, startsOn: r.starts_on, endsOn: r.ends_on,
    days: r.days, reason: r.reason, grantedByName: r.granted_by_name, revokedAt: r.revoked_at, createdAt: r.created_at,
  }));
}

export async function tierCounts(): Promise<{ tier: string; interval: string; count: number; courtesy: number }[]> {
  return sql()<{ tier: string; interval: string; count: number; courtesy: number }[]>`
    select coalesce(subscription->>'tier', 'free') as tier,
           case when coalesce(subscription->>'tier', 'free') = 'free' then '-' else coalesce(subscription->>'interval', 'monthly') end as interval,
           count(*)::int as count,
           count(*) filter (where subscription ? 'courtesyUntil')::int as courtesy
      from public.organizations group by 1, 2 order by 1, 2`;
}

export async function overdueSpaces(): Promise<{ id: string; name: string; tier: string; renewsOn: string }[]> {
  return sql()<{ id: string; name: string; tier: string; renews_on: string }[]>`
    select id, name, subscription->>'tier' as tier, coalesce(subscription->>'renewsOn', subscription->>'nextDueDate') as renews_on
      from public.organizations
     where coalesce(subscription->>'tier', 'free') <> 'free' and not (subscription ? 'courtesyUntil')
       and coalesce(subscription->>'renewsOn', subscription->>'nextDueDate') < to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')
     order by renews_on`.then((rows) => rows.map((r) => ({ id: r.id, name: r.name, tier: r.tier, renewsOn: r.renews_on })));
}
