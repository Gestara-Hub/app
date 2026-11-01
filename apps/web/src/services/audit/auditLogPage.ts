import { paginateArray, type AuditLogEntry, type AuditLogFilter, type PaginatedResult } from "@gestarahub/contracts";
import { endOfDayInSpace, startOfDayInSpace } from "@gestarahub/core/date";
import type { TenantContext } from "../server/tenant";
import { dbError } from "@/lib/log";

/** Linha do banco para o contrato. */
function entryOf(row: Record<string, unknown>): AuditLogEntry {
  return {
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
    ...(row.source ? { source: String(row.source) } : {}),
    ...(row.failed ? { failed: true } : {}),
    ...(row.error_reference ? { errorReference: String(row.error_reference) } : {}),
  };
}

/** `%` e `_` digitados na busca valem como texto, nao como curinga. */
function likeTerm(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Uma pagina do log (mais recente primeiro), com filtros, visibilidade e
 * paginacao no banco (doc 19, fase 3). O perfil e o do contexto da sessao: o
 * Gerente nao ve eventos de Dono/Gerente nem de Configuracoes (mesma regra de
 * `canView` em auditLogService). Modulo so do servidor.
 */
export async function auditLogPageFor(
  ctx: Pick<TenantContext, "client" | "organizationId" | "profile">,
  filter: AuditLogFilter | undefined,
  page: number,
  pageSize: number,
): Promise<PaginatedResult<AuditLogEntry>> {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const safeSize = Math.max(1, Math.min(100, Math.floor(pageSize) || 50));
  let query = ctx.client
    .from("audit_logs")
    .select("*", { count: "exact" })
    .eq("organization_id", ctx.organizationId);
  if (ctx.profile === "manager") {
    query = query.or("security.eq.false,and(target->>type.eq.user,target->>profile.in.(attendant,professional))");
  } else if (ctx.profile !== "owner") {
    return paginateArray([], safePage, safeSize);
  }
  if (filter?.security !== undefined) query = query.eq("security", filter.security);
  if (filter?.entityType) query = query.eq("target->>type", filter.entityType);
  if (filter?.action) query = query.eq("action", filter.action);
  if (filter?.actorId) query = query.eq("actor->>userId", filter.actorId);
  // Pessoas ou sistema (rotinas, parceiro de pagamentos); so o que falhou.
  if (filter?.actorKind === "system") query = query.not("source", "is", null);
  if (filter?.actorKind === "user") query = query.is("source", null);
  if (filter?.failed) query = query.eq("failed", true);
  // Dias do periodo no fuso do espaco (nao em UTC).
  if (filter?.dateFrom) {
    query = query.gte("timestamp", filter.dateFrom.length === 10 ? startOfDayInSpace(filter.dateFrom) : filter.dateFrom);
  }
  if (filter?.dateTo) {
    query = query.lte("timestamp", filter.dateTo.length === 10 ? endOfDayInSpace(filter.dateTo) : filter.dateTo);
  }
  if (filter?.search?.trim()) query = query.ilike("summary", likeTerm(filter.search.trim()));

  const from = (safePage - 1) * safeSize;
  const { data, error, count } = await query
    .order("timestamp", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + safeSize - 1);
  if (error) throw dbError(`auditoria: leitura`, error);
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / safeSize));
  return {
    items: (data ?? []).map(entryOf),
    total,
    page: safePage,
    pageSize: safeSize,
    totalPages,
    hasMore: safePage < totalPages,
  };
}
