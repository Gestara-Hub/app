import "server-only";
import { sql } from "./db";
import type { SubscriptionJson } from "../space-plan";

/**
 * Espacos (tenants) para o painel. So leitura do `public` pelas visoes do schema
 * `platform` e pelas colunas liberadas de `organizations`: nenhum dado de aluno.
 */
export const SPACES_PAGE_SIZE = 25;

export const SPACE_SORTS = ["recent", "name", "activity"] as const;
export type SpaceSort = (typeof SPACE_SORTS)[number];
export const SPACE_SITUATIONS = [
  "all",
  "paid",
  "grace",
  "reverted",
  "scheduled",
  "courtesy",
  "inactive",
  "no_access_30d",
  "no_online",
  "errors_24h",
] as const;
export type SpaceSituation = (typeof SPACE_SITUATIONS)[number];

export interface SpaceFilters {
  q?: string;
  tier?: "free" | "pro" | "scale";
  situation?: SpaceSituation;
  area?: string;
  createdWithin?: 7 | 30;
  sort?: SpaceSort;
  page: number;
}

export interface SpaceRow {
  id: string;
  name: string;
  area: string | null;
  customAreaName: string | null;
  model: string;
  status: "active" | "inactive";
  subscription: SubscriptionJson | null;
  createdAt: Date;
  ownerName: string | null;
  studentsActive: number;
  classesActive: number;
  usersActive: number;
  lastSignInAt: Date | null;
  gatewayStatus: string | null;
  errors24h: number;
}

type DbRow = {
  id: string;
  name: string;
  class_segment: string | null;
  custom_segment_name: string | null;
  model: string;
  status: "active" | "inactive";
  subscription: SubscriptionJson | null;
  created_at: Date;
  owner_name: string | null;
  students_active: number | null;
  classes_active: number | null;
  users_active: number | null;
  last_sign_in_at: Date | null;
  gateway_status: string | null;
  errors_24h: number;
};

const toSpace = (r: DbRow): SpaceRow => ({
  id: r.id,
  name: r.name,
  area: r.class_segment,
  customAreaName: r.custom_segment_name,
  model: r.model,
  status: r.status,
  subscription: r.subscription,
  createdAt: r.created_at,
  ownerName: r.owner_name,
  studentsActive: r.students_active ?? 0,
  classesActive: r.classes_active ?? 0,
  usersActive: r.users_active ?? 0,
  lastSignInAt: r.last_sign_in_at,
  gatewayStatus: r.gateway_status,
  errors24h: r.errors_24h,
});

const escapeLike = (value: string) => value.replace(/[%_\\]/g, "\\$&");

/** Lista filtrada; `limit` maior que a pagina serve a exportacao. */
export async function listSpaces(filters: SpaceFilters, opts: { all?: boolean } = {}): Promise<{ rows: SpaceRow[]; hasNext: boolean }> {
  const q = filters.q?.trim() ? `%${escapeLike(filters.q.trim())}%` : null;
  const situation = filters.situation ?? "all";
  const limit = opts.all ? 5000 : SPACES_PAGE_SIZE + 1;
  const offset = opts.all ? 0 : (filters.page - 1) * SPACES_PAGE_SIZE;
  const sort = filters.sort ?? "recent";

  const rows = await sql()<DbRow[]>`
    select * from (
      select o.id, o.name, o.class_segment, o.custom_segment_name, o.model, o.status, o.subscription, o.created_at,
             w.owner_name, s.students_active, s.classes_active, s.users_active, a.last_sign_in_at, o.gateway_status,
             (select count(*)::int from public.error_logs e where e.organization_id = o.id and e.level = 'error' and e.last_seen >= now() - interval '24 hours') as errors_24h
        from public.organizations o
        left join platform.space_owners w on w.organization_id = o.id
        left join platform.space_stats s on s.organization_id = o.id
        left join platform.space_activity a on a.organization_id = o.id
    ) t
    where (${q}::text is null or t.name ilike ${q} or t.id ilike ${q} or t.owner_name ilike ${q}
           or exists (select 1 from platform.space_owners w2 where w2.organization_id = t.id and w2.owner_email ilike ${q}))
      and (${filters.tier ?? null}::text is null or coalesce(t.subscription->>'tier', 'free') = ${filters.tier ?? null})
      and (${filters.area ?? null}::text is null or t.class_segment = ${filters.area ?? null})
      and (${filters.createdWithin ?? null}::int is null or t.created_at >= now() - make_interval(days => ${filters.createdWithin ?? 0}))
      and (
        ${situation} = 'all'
        or (${situation} = 'paid' and coalesce(t.subscription->>'tier', 'free') <> 'free')
        or (${situation} = 'grace' and coalesce(t.subscription->>'tier', 'free') <> 'free'
            and coalesce(t.subscription->>'renewsOn', t.subscription->>'nextDueDate') < to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'))
        or (${situation} = 'reverted' and coalesce(t.subscription->>'tier', 'free') = 'free' and t.subscription ? 'revertedFrom')
        or (${situation} = 'scheduled' and t.subscription ? 'scheduledChange')
        or (${situation} = 'courtesy' and t.subscription ? 'courtesyUntil')
        or (${situation} = 'inactive' and t.status = 'inactive')
        or (${situation} = 'no_access_30d' and (t.last_sign_in_at is null or t.last_sign_in_at < now() - interval '30 days'))
        or (${situation} = 'no_online' and coalesce(t.gateway_status, '') <> 'approved')
        or (${situation} = 'errors_24h' and t.errors_24h > 0)
      )
    order by case when ${sort} = 'name' then t.name end asc,
             case when ${sort} = 'activity' then t.last_sign_in_at end desc nulls last,
             t.created_at desc
    limit ${limit} offset ${offset}`;
  return { rows: rows.slice(0, opts.all ? rows.length : SPACES_PAGE_SIZE).map(toSpace), hasNext: !opts.all && rows.length > SPACES_PAGE_SIZE };
}

export async function spaceTotals(): Promise<{ total: number; paid: number; inactive: number; noAccess30d: number }> {
  const [row] = await sql()<{ total: number; paid: number; inactive: number; no_access: number }[]>`
    select count(*)::int as total,
           count(*) filter (where coalesce(o.subscription->>'tier', 'free') <> 'free')::int as paid,
           count(*) filter (where o.status = 'inactive')::int as inactive,
           count(*) filter (where a.last_sign_in_at is null or a.last_sign_in_at < now() - interval '30 days')::int as no_access
      from public.organizations o left join platform.space_activity a on a.organization_id = o.id`;
  return { total: row.total, paid: row.paid, inactive: row.inactive, noAccess30d: row.no_access };
}

export interface SpaceDetail extends SpaceRow {
  ownerEmail: string | null;
  termsAcceptedAt: Date | null;
  termsVersion: string | null;
  segment: string | null;
  settings: Record<string, unknown> | null;
  studentsTotal: number;
  teachersActive: number;
  chargesOpen: number;
  chargesOpenCents: number;
  lastAttendanceAt: Date | null;
  gatewayProvider: string | null;
  gatewayFeesSyncedAt: Date | null;
  online: { paidCount: number; paidCents: number; awaitingCount: number; lostCount: number; platformFeeCents: number };
}

export async function getSpace(id: string): Promise<SpaceDetail | null> {
  const [row] = await sql()<
    (DbRow & {
      owner_email: string | null;
      terms_accepted_at: Date | null;
      terms_version: string | null;
      segment: string | null;
      settings: Record<string, unknown> | null;
      students_total: number | null;
      teachers_active: number | null;
      charges_open: number | null;
      charges_open_cents: string | null;
      last_attendance_at: Date | null;
      gateway_provider: string | null;
      gateway_fees_synced_at: Date | null;
      paid_count: number | null;
      paid_cents: string | null;
      awaiting_count: number | null;
      lost_count: number | null;
      platform_fee_cents: string | null;
    })[]
  >`
    select o.id, o.name, o.class_segment, o.custom_segment_name, o.model, o.status, o.subscription, o.created_at, o.segment, o.settings,
           o.gateway_provider, o.gateway_status, o.gateway_fees_synced_at,
           w.owner_name, w.owner_email, w.terms_accepted_at, w.terms_version,
           s.students_active, s.students_total, s.classes_active, s.teachers_active, s.users_active, s.charges_open, s.charges_open_cents, s.last_attendance_at,
           a.last_sign_in_at,
           (select count(*)::int from public.error_logs e where e.organization_id = o.id and e.level = 'error' and e.last_seen >= now() - interval '24 hours') as errors_24h,
           p.paid_count, p.paid_cents, p.awaiting_count, p.lost_count, p.platform_fee_cents
      from public.organizations o
      left join platform.space_owners w on w.organization_id = o.id
      left join platform.space_stats s on s.organization_id = o.id
      left join platform.space_activity a on a.organization_id = o.id
      left join platform.space_online_30d p on p.organization_id = o.id
     where o.id = ${id}`;
  if (!row) return null;
  return {
    ...toSpace(row),
    ownerEmail: row.owner_email,
    termsAcceptedAt: row.terms_accepted_at,
    termsVersion: row.terms_version,
    segment: row.segment,
    settings: row.settings,
    studentsTotal: row.students_total ?? 0,
    teachersActive: row.teachers_active ?? 0,
    chargesOpen: row.charges_open ?? 0,
    chargesOpenCents: Number(row.charges_open_cents ?? 0),
    lastAttendanceAt: row.last_attendance_at,
    gatewayProvider: row.gateway_provider,
    gatewayFeesSyncedAt: row.gateway_fees_synced_at,
    online: {
      paidCount: row.paid_count ?? 0,
      paidCents: Number(row.paid_cents ?? 0),
      awaitingCount: row.awaiting_count ?? 0,
      lostCount: row.lost_count ?? 0,
      platformFeeCents: Number(row.platform_fee_cents ?? 0),
    },
  };
}

export interface PlanEventRow {
  id: string;
  kind: string;
  tierBefore: string | null;
  tierAfter: string | null;
  intervalBefore: string | null;
  intervalAfter: string | null;
  amountCents: number | null;
  effectiveOn: string | null;
  source: string | null;
  actorName: string | null;
  createdAt: Date;
}

export async function listPlanEvents(organizationId: string, limit = 50): Promise<PlanEventRow[]> {
  const rows = await sql()<
    { id: string; kind: string; tier_before: string | null; tier_after: string | null; interval_before: string | null; interval_after: string | null; amount_cents: number | null; effective_on: string | null; source: string | null; actor: { name?: string } | null; created_at: Date }[]
  >`select id, kind, tier_before, tier_after, interval_before, interval_after, amount_cents, effective_on::text, source, actor, created_at
      from public.subscription_events where organization_id = ${organizationId} order by created_at desc limit ${limit}`;
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    tierBefore: r.tier_before,
    tierAfter: r.tier_after,
    intervalBefore: r.interval_before,
    intervalAfter: r.interval_after,
    amountCents: r.amount_cents,
    effectiveOn: r.effective_on,
    source: r.source,
    actorName: r.actor?.name ?? null,
    createdAt: r.created_at,
  }));
}

export interface SpaceNote {
  id: string;
  adminName: string | null;
  body: string;
  pinned: boolean;
  createdAt: Date;
}

export async function listSpaceNotes(organizationId: string): Promise<SpaceNote[]> {
  const rows = await sql()<{ id: string; admin_name: string | null; body: string; pinned: boolean; created_at: Date }[]>`
    select id, admin_name, body, pinned, created_at from platform.space_notes where organization_id = ${organizationId} order by pinned desc, created_at desc`;
  return rows.map((r) => ({ id: r.id, adminName: r.admin_name, body: r.body, pinned: r.pinned, createdAt: r.created_at }));
}

export async function addSpaceNote(input: { organizationId: string; adminId: string; adminName: string; body: string }): Promise<void> {
  await sql()`insert into platform.space_notes (organization_id, admin_id, admin_name, body) values (${input.organizationId}, ${input.adminId}, ${input.adminName}, ${input.body})`;
}

export async function setSpaceNotePinned(id: string, pinned: boolean): Promise<void> {
  await sql()`update platform.space_notes set pinned = ${pinned} where id = ${id}`;
}

export async function deleteSpaceNote(id: string): Promise<{ organizationId: string } | null> {
  const [row] = await sql()<{ organization_id: string }[]>`delete from platform.space_notes where id = ${id} returning organization_id`;
  return row ? { organizationId: row.organization_id } : null;
}
