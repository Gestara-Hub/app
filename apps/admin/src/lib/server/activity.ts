import "server-only";
import { sql } from "./db";
import { listUserOccurrences } from "./health";
import { actionTitle, buildTimeline, type TimelineItem } from "../user-timeline";

/**
 * A linha do tempo de uma pessoa (doc technical/21): erros, ações auditadas e
 * conversas, numa janela em volta de um instante ou nos últimos dias. As ações
 * vêm da visão `platform.user_activity` (só tipo e hora, sem nome de aluno).
 */
export interface TimelineInput {
  userId: string;
  /** Espaço da pessoa; sem ele não há como buscar as ações auditadas. */
  organizationId: string | null;
  around?: Date;
  windowMinutes?: number;
  days?: number;
  limit?: number;
}

export async function userTimeline(input: TimelineInput): Promise<TimelineItem[]> {
  const limit = input.limit ?? 50;
  const window = input.windowMinutes ?? 30;
  const days = input.days ?? 7;
  const around = input.around ?? null;
  // Janela: ±minutos em volta do instante, ou os últimos dias (um dos dois vale).
  const [errors, actions, threads] = await Promise.all([
    listUserOccurrences({ userId: input.userId, around: input.around, windowMinutes: window, days, limit }),
    input.organizationId
      ? sql()<{ occurred_at: Date; action: string; target_type: string | null; failed: boolean; error_reference: string | null }[]>`
          select occurred_at, action, target_type, failed, error_reference
            from platform.user_activity
           where organization_id = ${input.organizationId} and user_id = ${input.userId}
             and (${around}::timestamptz is null
                  or occurred_at between ${around}::timestamptz - make_interval(mins => ${window}) and ${around}::timestamptz + make_interval(mins => ${window}))
             and (${around ? null : days}::int is null or occurred_at > now() - make_interval(days => ${around ? 0 : days}))
           order by occurred_at desc limit ${limit}`
      : Promise.resolve([]),
    sql()<{ id: string; number: number; subject: string; created_at: Date }[]>`
      select id, number, subject, created_at from platform.support_threads
       where user_id = ${input.userId}
         and (${around}::timestamptz is null
              or created_at between ${around}::timestamptz - make_interval(mins => ${window}) and ${around}::timestamptz + make_interval(mins => ${window}))
         and (${around ? null : days}::int is null or created_at > now() - make_interval(days => ${around ? 0 : days}))
       order by created_at desc limit ${limit}`,
  ]);
  return buildTimeline(
    errors.map((hit) => ({
      kind: "error" as const,
      at: hit.occurredAt,
      title: hit.event,
      detail: [hit.message, hit.context.route ? String(hit.context.route) : null, hit.context.release ? `versão ${String(hit.context.release)}` : null].filter(Boolean).join(" · "),
      href: `/health/errors/${hit.errorId}`,
      failed: true,
      reference: hit.reference,
    })),
    actions.map((a) => ({
      kind: "action" as const,
      at: a.occurred_at,
      title: actionTitle(a.action, a.target_type),
      detail: a.failed ? "falhou" : undefined,
      failed: a.failed,
      reference: a.error_reference,
    })),
    threads.map((t) => ({
      kind: "thread" as const,
      at: t.created_at,
      title: t.subject,
      detail: `Abriu a conversa GH-${t.number}`,
      href: `/support/${t.id}`,
    })),
  ).slice(0, limit);
}
