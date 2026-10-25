import "server-only";
import { actionsMatching } from "../audit-filters";
import { likePattern } from "../list-filters";
import { LIST_PAGE_SIZE, pageInfo } from "../pagination";
import { sql } from "./db";

/** Leitura da auditoria para a tela: filtros validados antes (lib/audit-filters), tudo como parâmetro do SQL. */
export interface AuditQuery {
  /** Grupo (prefixo da ação) ou "all". */
  group: string;
  q?: string;
  admin?: string;
  space?: string;
  /** Dias de Brasília "AAAA-MM-DD", inclusive nas duas pontas. */
  from?: string;
  to?: string;
  page: number;
}

export interface AuditRow {
  id: string;
  action: string;
  admin_name: string | null;
  organization_id: string | null;
  organization_name: string | null;
  reason: string | null;
  ip: string | null;
  created_at: Date;
}

export async function listAudit(query: AuditQuery): Promise<{ rows: AuditRow[]; total: number; page: number }> {
  const prefix = query.group === "all" ? null : `${query.group}.%`;
  const like = likePattern(query.q);
  const actions = actionsMatching(query.q);
  const admin = query.admin ?? null;
  const space = query.space ?? null;
  const from = query.from ?? null;
  const to = query.to ?? null;

  const run = (page: number) =>
    sql()<(AuditRow & { total: number })[]>`
      select a.id, a.action, a.admin_name, a.organization_id, o.name as organization_name, a.reason, a.ip, a.created_at,
             count(*) over()::int as total
      from platform.audit_logs a
      left join public.organizations o on o.id = a.organization_id
      where (${prefix}::text is null or a.action like ${prefix})
        and (${like}::text is null or a.admin_name ilike ${like} or a.reason ilike ${like} or o.name ilike ${like}
             or a.action ilike ${like} or a.action = any(${actions}::text[]))
        and (${admin}::uuid is null or a.admin_id = ${admin})
        and (${space}::text is null or a.organization_id::text = ${space})
        and (${from}::text is null or a.created_at >= (${from}::date)::timestamp at time zone 'America/Sao_Paulo')
        and (${to}::text is null or a.created_at < ((${to}::date) + 1)::timestamp at time zone 'America/Sao_Paulo')
      order by a.created_at desc, a.id
      limit ${LIST_PAGE_SIZE} offset ${(page - 1) * LIST_PAGE_SIZE}`;

  let page = Math.max(1, query.page);
  let rows = await run(page);
  let total = rows[0]?.total ?? 0;
  if (rows.length === 0 && page > 1) {
    // Página além do fim: mostra a última que existe.
    const first = await run(1);
    total = first[0]?.total ?? 0;
    page = pageInfo(1, total).totalPages;
    rows = page > 1 ? await run(page) : first;
  }
  return { rows, total, page };
}

/** Administradores que aparecem na auditoria (para o filtro por pessoa). */
export async function listAuditAdmins(): Promise<{ id: string; name: string }[]> {
  return sql()<{ id: string; name: string }[]>`
    select admin_id as id, coalesce(max(admin_name), 'Sem nome') as name
    from platform.audit_logs where admin_id is not null
    group by admin_id order by lower(coalesce(max(admin_name), '')), admin_id`;
}

/** Nome do espaço de um filtro `?space=` (para mostrar na tela). */
export async function spaceNameById(id: string): Promise<string | null> {
  const [row] = await sql()<{ name: string }[]>`select name from public.organizations where id = ${id}`;
  return row?.name ?? null;
}
