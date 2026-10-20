"use server";

import type { AuditLogEntry, AuditLogFilter } from "@gestarahub/contracts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function getClientForTenant() {
  try {
    const serverClient = await createSupabaseServerClient();
    const { data: { user } } = await serverClient.auth.getUser();
    if (user) return serverClient;
  } catch {
    // Fallback below
  }
  return createSupabaseAdminClient();
}

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

export async function listAuditLogsFromDb(
  organizationId: string,
  filter?: AuditLogFilter,
): Promise<AuditLogEntry[]> {
  const client = await getClientForTenant();
  let query = client
    .from("audit_logs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("timestamp", { ascending: false });

  if (filter?.security !== undefined) {
    query = query.eq("security", filter.security);
  }
  if (filter?.dateFrom) {
    const fromISO = filter.dateFrom.length === 10 ? `${filter.dateFrom}T00:00:00.000Z` : filter.dateFrom;
    query = query.gte("timestamp", fromISO);
  }
  if (filter?.dateTo) {
    const toISO = filter.dateTo.length === 10 ? `${filter.dateTo}T23:59:59.999Z` : filter.dateTo;
    query = query.lte("timestamp", toISO);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[auditLogBackend] Erro ao listar audit logs:", error);
    return [];
  }

  let entries: AuditLogEntry[] = (data ?? []).map((row) => ({
    id: String(row.id),
    organizationId: String(row.organization_id),
    unitId: String(row.unit_id || ""),
    timestamp: String(row.timestamp),
    actor: row.actor as AuditLogEntry["actor"],
    action: row.action as AuditLogEntry["action"],
    target: row.target as AuditLogEntry["target"],
    summary: String(row.summary),
    changes: (row.changes as AuditLogEntry["changes"]) || undefined,
    security: Boolean(row.security),
  }));

  if (filter?.entityType) {
    entries = entries.filter((e) => e.target.type === filter.entityType);
  }
  if (filter?.actorId) {
    entries = entries.filter((e) => e.actor.userId === filter.actorId);
  }
  if (filter?.search) {
    const term = filter.search.toLowerCase();
    entries = entries.filter((e) => e.summary.toLowerCase().includes(term));
  }

  return entries;
}
