import "server-only";
import type { AdminRole } from "../permissions";
import { sql } from "./db";
import { requestInfo } from "./request";

/**
 * Auditoria do painel (doc technical/26, secao 8): quem, quando, em qual espaco
 * e por que. Tabela so de acrescentar (gatilho no banco). Nunca grava senha,
 * codigo nem token: `target`, `before` e `after` sao so o que mudou.
 */
export interface AuditInput {
  admin: { id: string; name: string; role?: AdminRole } | null;
  action: string;
  organizationId?: string | null;
  target?: Record<string, unknown>;
  reason?: string;
  before?: unknown;
  after?: unknown;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  const { ip, userAgent } = await requestInfo();
  await sql()`
    insert into platform.audit_logs (admin_id, admin_name, action, organization_id, target, reason, before, after, ip, user_agent)
    values (
      ${input.admin?.id ?? null}, ${input.admin?.name ?? null}, ${input.action}, ${input.organizationId ?? null},
      ${sql().json((input.target ?? {}) as never)}, ${input.reason ?? null},
      ${input.before === undefined ? null : sql().json(input.before as never)},
      ${input.after === undefined ? null : sql().json(input.after as never)},
      ${ip}, ${userAgent}
    )
  `;
}
