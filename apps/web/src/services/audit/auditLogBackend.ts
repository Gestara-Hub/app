"use server";

import type { AuditLogEntry, AuditLogFilter, PaginatedResult } from "@gestarahub/contracts";
import { getClientForTenant } from "@/lib/supabase/tenant-client";
import { requireTenant } from "../server/tenant";
import { auditLogPageFor } from "./auditLogPage";


export async function recordAuditLogInDb(entry: AuditLogEntry): Promise<void> {
  try {
    const client = await getClientForTenant();
    await client.from("audit_logs").insert({
      id: entry.id,
      organization_id: entry.organizationId,
      unit_id: entry.unitId || null,
      timestamp: entry.timestamp,
      actor: entry.actor,
      action: entry.action,
      target: entry.target,
      summary: entry.summary,
      changes: entry.changes || null,
      security: entry.security ?? false,
    });
  } catch (err) {
    console.error("[auditLogBackend] Erro ao gravar audit log no Postgres:", err);
  }
}

/** Uma pagina do log para quem esta na sessao (perfil da sessao, nunca do navegador). */
export async function listAuditLogPage(
  filter: AuditLogFilter | undefined,
  page: number,
  pageSize: number,
): Promise<PaginatedResult<AuditLogEntry>> {
  const ctx = await requireTenant();
  ctx.require("audit:view");
  return auditLogPageFor(ctx, filter, page, pageSize);
}
