import "server-only";
import { parseProtocol } from "@gestarahub/core/support-protocol";
import { sql } from "./db";
import { likePattern, normalizeSearch } from "../filter-input";
import { LIST_PAGE_SIZE } from "../pagination";
import { fetchPage } from "./page-fetch";
import { parseCrumbs } from "../crumbs-view";
import type { BugStatus, ThreadDetail, ThreadFilter, ThreadKind, ThreadMessage, ThreadRow, ThreadStatus } from "../support-types";

/** Consultas e gravacoes do Suporte (schema `platform`). Quem chama confere o papel e grava a auditoria. */

type Row = {
  id: string;
  number: number;
  kind: ThreadKind;
  bug_status: BugStatus | null;
  regressed: boolean;
  subject: string;
  status: ThreadStatus;
  urgent: boolean;
  user_name: string;
  user_email: string;
  organization_id: string;
  organization_name: string;
  plan_tier: string | null;
  created_at: Date;
  last_message_at: Date;
  last_customer_message_at: Date | null;
  escalated_at: Date | null;
};

const toRow = (r: Row): ThreadRow => ({
  id: r.id,
  number: r.number,
  kind: r.kind,
  bugStatus: r.kind === "bug" ? (r.bug_status ?? "new") : null,
  regressed: r.regressed,
  subject: r.subject,
  status: r.status,
  urgent: r.urgent,
  userName: r.user_name,
  userEmail: r.user_email,
  organizationId: r.organization_id,
  organizationName: r.organization_name,
  planTier: r.plan_tier,
  createdAt: r.created_at,
  lastMessageAt: r.last_message_at,
  lastCustomerMessageAt: r.last_customer_message_at,
  escalatedAt: r.escalated_at,
});

export const PAGE_SIZE = LIST_PAGE_SIZE;

/** Período da última mensagem e ordem da lista (sem ordem escolhida vale a regra da fila). */
export const THREAD_PERIODS = { today: "Hoje", "7d": "Últimos 7 dias", "30d": "Últimos 30 dias" } as const;
export type ThreadPeriod = keyof typeof THREAD_PERIODS;
export type ThreadOrder = "oldest" | "newest";


export async function listThreads(input: {
  filter: ThreadFilter;
  kind?: ThreadKind;
  q?: string;
  /** Só as conversas deste espaço (ficha do espaço). */
  organizationId?: string;
  urgent?: boolean;
  period?: ThreadPeriod;
  order?: ThreadOrder;
  page: number;
}): Promise<{ rows: ThreadRow[]; hasNext: boolean; total: number; page: number }> {
  const status = input.filter === "attention" ? "waiting_us" : input.filter === "all" ? null : input.filter;
  const q = likePattern(normalizeSearch(input.q));
  // Protocolo (GH-1042, #1042, 1042): acha pelo número, além do texto.
  const protocol = parseProtocol(normalizeSearch(input.q));
  const organizationId = input.organizationId ?? null;
  const urgent = input.urgent ? true : null;
  const period = input.period ?? null;
  const order = input.order ?? null;
  const result = await fetchPage(input.page, (page) =>
    sql()<(Row & { total: number })[]>`
      select t.id, t.number, t.kind, t.bug_status,
             (t.bug_status = 'fixed' and t.fixed_at is not null and exists (
                select 1 from public.error_occurrences oc
                 where oc.error_id = (select o2.error_id from public.error_occurrences o2 where o2.reference = t.error_reference)
                   and oc.occurred_at > t.fixed_at)) as regressed,
             t.subject, t.status, t.urgent, t.user_name, t.user_email, t.organization_id, o.name as organization_name,
             t.plan_tier, t.created_at, t.last_message_at, t.last_customer_message_at, t.escalated_at, (count(*) over ())::int as total
        from platform.support_threads t
        join public.organizations o on o.id = t.organization_id
       where (${status}::text is null or t.status = ${status})
         and (${input.kind ?? null}::text is null or t.kind = ${input.kind ?? null})
         and (${organizationId}::text is null or t.organization_id = ${organizationId})
         and (${urgent}::boolean is null or t.urgent = ${urgent})
         and (${period}::text is null
              or (${period}::text = 'today' and t.last_message_at >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
              or (${period}::text = '7d' and t.last_message_at >= now() - interval '7 days')
              or (${period}::text = '30d' and t.last_message_at >= now() - interval '30 days'))
         and (${q}::text is null or t.number = ${protocol}::int or t.subject ilike ${q} or o.name ilike ${q} or t.user_name ilike ${q} or t.user_email ilike ${q})
       order by case when ${order}::text is not null then 0 when t.status = 'waiting_us' then 0 else 1 end,
                case when ${order}::text is null then t.urgent end desc,
                case when ${order}::text is null and t.status = 'waiting_us' then coalesce(t.last_customer_message_at, t.created_at) end asc,
                case when ${order}::text = 'oldest' then t.last_message_at end asc,
                t.last_message_at desc,
                t.id
       limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`,
  );
  return { rows: result.rows.map(toRow), hasNext: result.page * PAGE_SIZE < result.total, total: result.total, page: result.page };
}

export async function threadCounts(): Promise<{ attention: number; urgent: number; waitingCustomer: number; bot: number }> {
  const [row] = await sql()<{ attention: number; urgent: number; waiting_customer: number; bot: number }[]>`
    select count(*) filter (where status = 'waiting_us')::int as attention,
           count(*) filter (where status = 'waiting_us' and urgent)::int as urgent,
           count(*) filter (where status = 'waiting_customer')::int as waiting_customer,
           count(*) filter (where status = 'bot')::int as bot
      from platform.support_threads`;
  return { attention: row.attention, urgent: row.urgent, waitingCustomer: row.waiting_customer, bot: row.bot };
}

export async function getThread(id: string): Promise<ThreadDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await sql()<(Row & { user_id: string; breadcrumbs: unknown; fixed_in: string | null; fixed_at: Date | null; summary: string | null; origin_screen: string | null; error_reference: string | null; client_info: string | null; bot_helped: boolean | null })[]>`
    select t.id, t.number, t.kind, t.bug_status,
           (t.bug_status = 'fixed' and t.fixed_at is not null and exists (
              select 1 from public.error_occurrences oc
               where oc.error_id = (select o2.error_id from public.error_occurrences o2 where o2.reference = t.error_reference)
                 and oc.occurred_at > t.fixed_at)) as regressed,
           t.subject, t.status, t.urgent, t.user_name, t.user_email, t.organization_id, o.name as organization_name,
           t.plan_tier, t.created_at, t.last_message_at, t.last_customer_message_at, t.escalated_at,
           t.fixed_in, t.fixed_at, t.breadcrumbs, t.user_id, t.summary, t.origin_screen, t.error_reference, t.client_info, t.bot_helped
      from platform.support_threads t join public.organizations o on o.id = t.organization_id
     where t.id = ${id}`;
  if (!row) return null;
  const messages = await sql()<{ id: string; author: ThreadMessage["author"]; staff_name: string | null; body: string; internal: boolean; created_at: Date }[]>`
    select id, author, staff_name, body, internal, created_at from platform.support_messages where thread_id = ${id} order by created_at`;
  // Corrigido e o erro voltou: quantas vezes, quando foi a última e em que versão.
  const [back] = row.regressed
    ? await sql()<{ count: number; last_at: Date; last_release: string | null }[]>`
        select count(*)::int as count, max(oc.occurred_at) as last_at,
               (array_agg(oc.context ->> 'release' order by oc.occurred_at desc))[1] as last_release
          from public.error_occurrences oc
         where oc.error_id = (select o2.error_id from public.error_occurrences o2 where o2.reference = ${row.error_reference})
           and oc.occurred_at > ${row.fixed_at}`
    : [];
  return {
    ...toRow(row),
    userId: row.user_id,
    summary: row.summary,
    originScreen: row.origin_screen,
    errorReference: row.error_reference,
    clientInfo: row.client_info,
    breadcrumbs: parseCrumbs(row.breadcrumbs),
    fixedIn: row.fixed_in,
    fixedAt: row.fixed_at,
    regression: back ? { count: back.count, lastAt: back.last_at, lastRelease: back.last_release } : null,
    botHelped: row.bot_helped,
    messages: messages.map((m) => ({ id: m.id, author: m.author, staffName: m.staff_name, body: m.body, internal: m.internal, createdAt: m.created_at })),
  };
}

export async function addStaffReply(input: { threadId: string; adminId: string; adminName: string; body: string }): Promise<void> {
  await sql().begin(async (tx) => {
    await tx`insert into platform.support_messages (thread_id, author, staff_admin_id, staff_name, body)
             values (${input.threadId}, 'staff', ${input.adminId}, ${input.adminName}, ${input.body})`;
    await tx`update platform.support_threads set status = 'waiting_customer', last_message_at = now(),
                    first_reply_at = coalesce(first_reply_at, now()), resolved_at = null
              where id = ${input.threadId}`;
  });
}

export async function addInternalNote(input: { threadId: string; adminId: string; adminName: string; body: string }): Promise<void> {
  await sql()`insert into platform.support_messages (thread_id, author, staff_admin_id, staff_name, body, internal)
              values (${input.threadId}, 'staff', ${input.adminId}, ${input.adminName}, ${input.body}, true)`;
}

export async function setThreadStatus(threadId: string, status: "resolved" | "waiting_us"): Promise<void> {
  if (status === "resolved") {
    await sql()`update platform.support_threads set status = 'resolved', resolved_at = now(), urgent = false where id = ${threadId}`;
  } else {
    await sql()`update platform.support_threads set status = 'waiting_us', resolved_at = null,
                       last_customer_message_at = coalesce(last_customer_message_at, now()) where id = ${threadId}`;
  }
}

/**
 * Andamento de um problema relatado. "Corrigido" guarda quando e em que versão (texto
 * livre, em geral o commit); os outros estados limpam isso. Só vale para conversa do
 * tipo problema. Devolve falso se a conversa não é um problema.
 */
export async function setBugStatus(input: { threadId: string; status: BugStatus; fixedIn?: string | null }): Promise<boolean> {
  const fixed = input.status === "fixed";
  const rows = await sql()<{ id: string }[]>`
    update platform.support_threads set
      bug_status = ${input.status},
      fixed_in = ${fixed ? (input.fixedIn?.trim() || null) : null},
      fixed_at = ${fixed ? sql()`now()` : null}
    where id = ${input.threadId} and kind = 'bug'
    returning id`;
  return rows.length > 0;
}

export async function setThreadUrgent(threadId: string, urgent: boolean): Promise<void> {
  await sql()`update platform.support_threads set urgent = ${urgent} where id = ${threadId}`;
}

export interface Macro {
  id: string;
  title: string;
  body: string;
}

export async function listMacros(): Promise<Macro[]> {
  return sql()<Macro[]>`select id, title, body from platform.support_macros order by title`;
}

export async function saveMacro(input: { id?: string; title: string; body: string; adminId: string }): Promise<void> {
  if (input.id) {
    await sql()`update platform.support_macros set title = ${input.title}, body = ${input.body}, updated_at = now() where id = ${input.id}`;
  } else {
    await sql()`insert into platform.support_macros (title, body, created_by) values (${input.title}, ${input.body}, ${input.adminId})`;
  }
}

export async function deleteMacro(id: string): Promise<void> {
  await sql()`delete from platform.support_macros where id = ${id}`;
}

export async function supportNotifyEmail(): Promise<string | null> {
  const [row] = await sql()<{ value: string }[]>`select value::text from platform.settings where key = 'support.notify_email'`;
  const email = row?.value.replace(/^"|"$/g, "").trim();
  return email || null;
}

export interface HelpMiss {
  term: string;
  searches: number;
  spaces: number;
  lastAt: Date;
}

export interface HelpFeedbackRow {
  chunkId: string;
  helpful: number;
  notHelpful: number;
}

export const HELP_DAYS = [7, 30, 90] as const;

/** Buscas da ajuda do app sem resultado, mais repetidas primeiro (doc technical/26, 18.2): o que falta escrever. */
export async function listHelpMisses(days = 30): Promise<HelpMiss[]> {
  const rows = await sql()<{ term: string; searches: number; spaces: number; last_at: Date }[]>`
    select term, count(*)::int as searches, count(distinct organization_id)::int as spaces, max(created_at) as last_at
      from platform.help_events
     where kind = 'miss' and created_at > now() - make_interval(days => ${days})
     group by term
     order by searches desc, last_at desc
     limit 50`;
  return rows.map((r) => ({ term: r.term, searches: r.searches, spaces: r.spaces, lastAt: r.last_at }));
}

/** O mesmo, com busca pelo termo e paginação com o total de termos. */
export async function listHelpMissesPage(input: { days: number; q?: string; page: number }): Promise<{ rows: HelpMiss[]; total: number; page: number; hasNext: boolean }> {
  const q = likePattern(normalizeSearch(input.q));
  const result = await fetchPage(input.page, (page) =>
    sql()<{ term: string; searches: number; spaces: number; last_at: Date; total: number }[]>`
      select term, count(*)::int as searches, count(distinct organization_id)::int as spaces, max(created_at) as last_at, (count(*) over ())::int as total
        from platform.help_events
       where kind = 'miss' and created_at > now() - make_interval(days => ${input.days})
         and (${q}::text is null or term ilike ${q})
       group by term
       order by searches desc, last_at desc, term
       limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`,
  );
  return {
    rows: result.rows.map((r) => ({ term: r.term, searches: r.searches, spaces: r.spaces, lastAt: r.last_at })),
    total: result.total,
    page: result.page,
    hasNext: result.page * PAGE_SIZE < result.total,
  };
}

/** Totais do período (sem a busca): quantas buscas sem resultado e de quantos termos. */
export async function helpMissTotals(days: number): Promise<{ searches: number; terms: number }> {
  const [row] = await sql()<{ searches: number; terms: number }[]>`
    select count(*)::int as searches, count(distinct term)::int as terms
      from platform.help_events where kind = 'miss' and created_at > now() - make_interval(days => ${days})`;
  return { searches: row.searches, terms: row.terms };
}

/** "Isso ajudou?" por trecho; os que menos ajudam vêm primeiro. */
export async function listHelpFeedback(days = 30): Promise<HelpFeedbackRow[]> {
  const rows = await sql()<{ chunk_id: string; helpful: number; not_helpful: number }[]>`
    select chunk_id,
           count(*) filter (where kind = 'helpful')::int as helpful,
           count(*) filter (where kind = 'not_helpful')::int as not_helpful
      from platform.help_events
     where kind <> 'miss' and created_at > now() - make_interval(days => ${days})
     group by chunk_id
     order by not_helpful desc, helpful asc, chunk_id
     limit 50`;
  return rows.map((r) => ({ chunkId: r.chunk_id, helpful: r.helpful, notHelpful: r.not_helpful }));
}

/** As conversas de uma pessoa (mais novas primeiro), para a visão "tudo desta pessoa". */
export async function listUserThreads(userId: string): Promise<{ id: string; number: number; kind: ThreadKind; subject: string; status: ThreadStatus; createdAt: Date; userName: string; userEmail: string; organizationId: string; organizationName: string }[]> {
  const rows = await sql()<{ id: string; number: number; kind: ThreadKind; subject: string; status: ThreadStatus; created_at: Date; user_name: string; user_email: string; organization_id: string; organization_name: string }[]>`
    select t.id, t.number, t.kind, t.subject, t.status, t.created_at, t.user_name, t.user_email, t.organization_id, o.name as organization_name
      from platform.support_threads t join public.organizations o on o.id = t.organization_id
     where t.user_id = ${userId} order by t.created_at desc limit 20`;
  return rows.map((r) => ({ id: r.id, number: r.number, kind: r.kind, subject: r.subject, status: r.status, createdAt: r.created_at, userName: r.user_name, userEmail: r.user_email, organizationId: r.organization_id, organizationName: r.organization_name }));
}
