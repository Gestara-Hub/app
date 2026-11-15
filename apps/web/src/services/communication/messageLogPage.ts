import type { MessageLog, MessageLogFilter, PaginatedResult } from "@gestarahub/contracts";
import { endOfDayInSpace, startOfDayInSpace } from "@gestarahub/core/date";
import type { TenantContext } from "../server/tenant";
import { dbError } from "@/lib/log";

/** Linha do banco para o contrato. */
function logOf(row: Record<string, unknown>): MessageLog {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    recipientName: String(row.recipient_name),
    recipientPhone: String(row.recipient_phone),
    trigger: row.trigger as MessageLog["trigger"],
    category: row.category as MessageLog["category"],
    content: String(row.content),
    status: row.status as MessageLog["status"],
    ...(row.client_id ? { clientId: String(row.client_id) } : {}),
    ...(row.charge_id ? { chargeId: String(row.charge_id) } : {}),
    sentAt: String(row.sent_at),
    ...(row.read_at ? { readAt: String(row.read_at) } : {}),
    ...(row.error_reason ? { errorReason: String(row.error_reason) } : {}),
  };
}

/** Valor dentro do `or` do PostgREST: entre aspas, com `%`/`_` valendo como texto. */
function orLike(term: string): string {
  const escaped = term.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/"/g, '\\"');
  return `"%${escaped}%"`;
}

/**
 * Uma pagina do historico de mensagens (mais nova primeiro), com filtros e
 * paginacao no banco (doc 19, secao 12). Mesmos filtros da tela: situacao,
 * tipo (`messageKindMatches`), gatilho, aluno e busca por nome, telefone ou
 * texto. Modulo so do servidor.
 */
export async function messageLogPageFor(
  ctx: Pick<TenantContext, "client" | "organizationId">,
  filter: MessageLogFilter | undefined,
): Promise<PaginatedResult<MessageLog>> {
  const page = Math.max(1, Math.floor(filter?.page ?? 1) || 1);
  const pageSize = Math.max(1, Math.min(100, Math.floor(filter?.pageSize ?? 25) || 25));
  let query = ctx.client
    .from("message_logs")
    .select("*", { count: "exact" })
    .eq("organization_id", ctx.organizationId);
  if (filter?.clientId) query = query.eq("client_id", filter.clientId);
  if (filter?.trigger && filter.trigger !== "all") query = query.eq("trigger", filter.trigger);
  if (filter?.status && filter.status !== "all") query = query.eq("status", filter.status);
  if (filter?.kind === "manual") query = query.eq("trigger", "manual_broadcast");
  if (filter?.kind === "billing") query = query.eq("category", "billing");
  if (filter?.kind === "retention") query = query.eq("category", "retention");
  if (filter?.kind === "notices") query = query.eq("category", "administrative").neq("trigger", "manual_broadcast");
  // Dias do periodo no fuso do espaco (nao em UTC).
  if (filter?.dateFrom) {
    query = query.gte("sent_at", filter.dateFrom.length === 10 ? startOfDayInSpace(filter.dateFrom) : filter.dateFrom);
  }
  if (filter?.dateTo) {
    query = query.lte("sent_at", filter.dateTo.length === 10 ? endOfDayInSpace(filter.dateTo) : filter.dateTo);
  }
  const term = filter?.search?.trim();
  if (term) {
    const digits = term.replace(/\D/g, "");
    const parts = [`recipient_name.ilike.${orLike(term)}`, `content.ilike.${orLike(term)}`];
    if (digits) parts.push(`recipient_phone.ilike.${orLike(digits)}`);
    query = query.or(parts.join(","));
  }
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order("sent_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw dbError(`mensagens: leitura`, error);
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return { items: (data ?? []).map(logOf), total, page, pageSize, totalPages, hasMore: page < totalPages };
}
