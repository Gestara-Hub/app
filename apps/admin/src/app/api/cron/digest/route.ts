import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { buildDigest } from "@/lib/digest";
import { sendEmail } from "@/lib/server/email";
import { getEnv } from "@/lib/server/env";
import { sql } from "@/lib/server/db";
import { supportNotifyEmail } from "@/lib/server/support";

/**
 * Resumo diario do suporte por e-mail (agende uma vez por dia util, de manha):
 * GET com `Authorization: Bearer <CRON_SECRET>`. Sem o segredo configurado ou
 * com segredo errado, recusa. Nao grava nada; so le e envia.
 */
function authorized(request: NextRequest): boolean {
  const secret = getEnv().CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  const env = getEnv();
  const to = (await supportNotifyEmail()) ?? env.ADMIN_NOTIFY_EMAIL;
  const threads = await sql()<{ subject: string; organization_name: string; user_name: string; urgent: boolean; since: Date }[]>`
    select t.subject, o.name as organization_name, t.user_name, t.urgent, coalesce(t.last_customer_message_at, t.created_at) as since
      from platform.support_threads t join public.organizations o on o.id = t.organization_id
     where t.status = 'waiting_us'`;
  const [{ waiting }] = await sql()<{ waiting: number }[]>`select count(*)::int as waiting from platform.support_threads where status = 'waiting_customer'`;
  const digestInput = {
    threads: threads.map((t) => ({ subject: t.subject, organizationName: t.organization_name, userName: t.user_name, urgent: t.urgent, since: t.since })),
    waitingCustomer: waiting,
    now: new Date(),
    panelUrl: request.nextUrl.origin,
  };
  const digest = buildDigest(digestInput);
  if (!digest) return NextResponse.json({ ok: true, sent: false, reason: "nothing_waiting" });
  if (!to) return NextResponse.json({ ok: true, sent: false, reason: "no_recipient", waiting: threads.length });
  const sent = await sendEmail({
    to: { email: to },
    subject: digest.subject,
    text: digest.text,
    html: (icon) => buildDigest({ ...digestInput, icon })?.html ?? digest.html,
  });
  return NextResponse.json({ ok: true, sent, waiting: threads.length });
}
