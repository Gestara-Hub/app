import "server-only";
import { sql } from "./db";
import type { ThreadDetail, ThreadFilter, ThreadMessage, ThreadRow, ThreadStatus } from "../support-types";

/** Consultas e gravacoes do Suporte (schema `platform`). Quem chama confere o papel e grava a auditoria. */

type Row = {
  id: string;
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

export const PAGE_SIZE = 25;

export async function listThreads(input: { filter: ThreadFilter; q?: string; page: number }): Promise<{ rows: ThreadRow[]; hasNext: boolean }> {
  const status = input.filter === "attention" ? "waiting_us" : input.filter === "all" ? null : input.filter;
  const q = input.q?.trim() ? `%${input.q.trim().replace(/[%_\\]/g, "\\$&")}%` : null;
  const rows = await sql()<Row[]>`
    select t.id, t.subject, t.status, t.urgent, t.user_name, t.user_email, t.organization_id, o.name as organization_name,
           t.plan_tier, t.created_at, t.last_message_at, t.last_customer_message_at, t.escalated_at
      from platform.support_threads t
      join public.organizations o on o.id = t.organization_id
     where (${status}::text is null or t.status = ${status})
       and (${q}::text is null or t.subject ilike ${q} or o.name ilike ${q} or t.user_name ilike ${q} or t.user_email ilike ${q})
     order by case when t.status = 'waiting_us' then 0 else 1 end,
              t.urgent desc,
              case when t.status = 'waiting_us' then coalesce(t.last_customer_message_at, t.created_at) end asc,
              t.last_message_at desc
     limit ${PAGE_SIZE + 1} offset ${(input.page - 1) * PAGE_SIZE}`;
  return { rows: rows.slice(0, PAGE_SIZE).map(toRow), hasNext: rows.length > PAGE_SIZE };
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
  const [row] = await sql()<(Row & { summary: string | null; origin_screen: string | null; error_reference: string | null; bot_helped: boolean | null })[]>`
    select t.id, t.subject, t.status, t.urgent, t.user_name, t.user_email, t.organization_id, o.name as organization_name,
           t.plan_tier, t.created_at, t.last_message_at, t.last_customer_message_at, t.escalated_at,
           t.summary, t.origin_screen, t.error_reference, t.bot_helped
      from platform.support_threads t join public.organizations o on o.id = t.organization_id
     where t.id = ${id}`;
  if (!row) return null;
  const messages = await sql()<{ id: string; author: ThreadMessage["author"]; staff_name: string | null; body: string; internal: boolean; created_at: Date }[]>`
    select id, author, staff_name, body, internal, created_at from platform.support_messages where thread_id = ${id} order by created_at`;
  return {
    ...toRow(row),
    summary: row.summary,
    originScreen: row.origin_screen,
    errorReference: row.error_reference,
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
