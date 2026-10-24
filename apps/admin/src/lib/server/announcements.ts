import "server-only";
import { sql } from "./db";

/**
 * Comunicados aos espacos (doc technical/26, fase 5). O painel cria, edita e
 * arquiva; o app dos clientes le pela funcao `public.announcements_for`.
 */
export type Severity = "info" | "warning" | "urgent";
export type Audience = "all" | "tier" | "area" | "spaces";
export type AnnouncementState = "active" | "scheduled" | "ended" | "archived";

export interface AnnouncementInput {
  title: string;
  body: string;
  severity: Severity;
  audience: Audience;
  filter: { tiers?: string[]; areas?: string[]; spaces?: string[] };
  /** Vazio: comeca agora (hora do banco, sem depender do relogio do app). */
  startsAt: Date | null;
  endsAt: Date | null;
}

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  audience: Audience;
  filter: AnnouncementInput["filter"];
  startsAt: Date;
  endsAt: Date | null;
  createdByName: string | null;
  archivedAt: Date | null;
  dismissed: number;
  state: AnnouncementState;
}

export function stateOf(row: { startsAt: Date; endsAt: Date | null; archivedAt: Date | null }, now = new Date()): AnnouncementState {
  if (row.archivedAt) return "archived";
  if (row.startsAt > now) return "scheduled";
  if (row.endsAt && row.endsAt <= now) return "ended";
  return "active";
}

interface Raw {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  audience: Audience;
  audience_filter: AnnouncementInput["filter"];
  starts_at: Date;
  ends_at: Date | null;
  created_by_name: string | null;
  archived_at: Date | null;
  dismissed: number;
}

function map(r: Raw): AnnouncementRow {
  const base = { startsAt: r.starts_at, endsAt: r.ends_at, archivedAt: r.archived_at };
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    severity: r.severity,
    audience: r.audience,
    filter: r.audience_filter,
    createdByName: r.created_by_name,
    dismissed: r.dismissed,
    ...base,
    state: stateOf(base),
  };
}

export async function listAnnouncements(): Promise<AnnouncementRow[]> {
  const rows = await sql()<Raw[]>`
    select a.id, a.title, a.body, a.severity, a.audience, a.audience_filter, a.starts_at, a.ends_at,
           a.created_by_name, a.archived_at,
           (select count(*)::int from platform.announcement_reads r where r.announcement_id = a.id) as dismissed
      from platform.announcements a
     order by a.created_at desc
     limit 200`;
  return rows.map(map);
}

export async function getAnnouncement(id: string): Promise<AnnouncementRow | null> {
  const [row] = await sql()<Raw[]>`
    select a.id, a.title, a.body, a.severity, a.audience, a.audience_filter, a.starts_at, a.ends_at,
           a.created_by_name, a.archived_at,
           (select count(*)::int from platform.announcement_reads r where r.announcement_id = a.id) as dismissed
      from platform.announcements a where a.id = ${id}`;
  return row ? map(row) : null;
}

export async function audienceCount(audience: Audience, filter: AnnouncementInput["filter"]): Promise<number> {
  const [row] = await sql()<{ n: number }[]>`select platform.audience_count(${audience}, ${sql().json(filter as never)}) as n`;
  return row.n;
}

export async function createAnnouncement(input: AnnouncementInput, admin: { id: string; name: string }): Promise<string> {
  const [row] = await sql()<{ id: string }[]>`
    insert into platform.announcements (title, body, severity, audience, audience_filter, starts_at, ends_at, created_by, created_by_name)
    values (${input.title}, ${input.body}, ${input.severity}, ${input.audience}, ${sql().json(input.filter as never)},
            coalesce(${input.startsAt}::timestamptz, now()), ${input.endsAt}, ${admin.id}, ${admin.name})
    returning id`;
  return row.id;
}

export async function updateAnnouncement(id: string, input: AnnouncementInput): Promise<void> {
  await sql()`
    update platform.announcements
       set title = ${input.title}, body = ${input.body}, severity = ${input.severity}, audience = ${input.audience},
           audience_filter = ${sql().json(input.filter as never)}, starts_at = coalesce(${input.startsAt}::timestamptz, starts_at), ends_at = ${input.endsAt},
           updated_at = now()
     where id = ${id}`;
}

export async function setArchived(id: string, archived: boolean): Promise<void> {
  await sql()`update platform.announcements set archived_at = ${archived ? new Date() : null}, updated_at = now() where id = ${id}`;
}
