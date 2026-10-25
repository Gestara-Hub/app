import "server-only";
import { clampPage, likePattern, normalizeSearch } from "../filter-input";
import { LIST_PAGE_SIZE } from "../pagination";
import { sql } from "./db";
import { requestInfo } from "./request";

/**
 * LGPD no painel (doc technical/26, fase 6): pedidos do titular de dados (prazo
 * de 15 dias), inativar/reativar espaco e exportar os dados de um espaco. As
 * duas acoes sobre o espaco sao funcoes do banco (validam, gravam e registram
 * na Auditoria do espaco e na do painel na mesma transacao).
 */
export class PrivacyError extends Error {}

export const REQUEST_KINDS = {
  access: "Acesso aos dados",
  correction: "Correção de dados",
  deletion: "Exclusão de dados",
  portability: "Portabilidade",
  revoke_consent: "Revogar consentimento",
  other: "Outro",
} as const;
export type RequestKind = keyof typeof REQUEST_KINDS;
export const REQUEST_STATUS = { open: "Aberto", in_progress: "Em andamento", done: "Concluído", rejected: "Recusado" } as const;
export type RequestStatus = keyof typeof REQUEST_STATUS;

export interface PrivacyRequest {
  id: string;
  organizationId: string | null;
  spaceName: string | null;
  requesterName: string;
  requesterEmail: string;
  kind: RequestKind;
  description: string;
  status: RequestStatus;
  receivedAt: Date;
  dueAt: Date;
  resolution: string | null;
  handledByName: string | null;
  closedAt: Date | null;
}

interface Raw {
  id: string;
  organization_id: string | null;
  space_name: string | null;
  requester_name: string;
  requester_email: string;
  kind: RequestKind;
  description: string;
  status: RequestStatus;
  received_at: Date;
  due_at: Date;
  resolution: string | null;
  handled_by_name: string | null;
  closed_at: Date | null;
}

const map = (r: Raw): PrivacyRequest => ({
  id: r.id,
  organizationId: r.organization_id,
  spaceName: r.space_name,
  requesterName: r.requester_name,
  requesterEmail: r.requester_email,
  kind: r.kind,
  description: r.description,
  status: r.status,
  receivedAt: r.received_at,
  dueAt: r.due_at,
  resolution: r.resolution,
  handledByName: r.handled_by_name,
  closedAt: r.closed_at,
});

export type RequestFilter = "pending" | "overdue" | "closed" | "all";

export interface RequestQuery {
  filter: RequestFilter;
  /** Busca por nome, e-mail, descrição ou código do espaço (já normalizada, até 100 caracteres). */
  q?: string;
  kind?: RequestKind;
  page?: number;
}

/**
 * Pedidos paginados (25 por página) com o total do filtro. Ordem: em aberto primeiro, por prazo.
 * Página acima do total devolve a última existente (`page` no retorno).
 */
export async function listRequests(query: RequestQuery): Promise<{ rows: PrivacyRequest[]; total: number; page: number }> {
  const pattern = likePattern(normalizeSearch(query.q));
  const kind = query.kind ?? null;
  const where = sql()`
    case ${query.filter}::text
      when 'pending' then p.status in ('open', 'in_progress')
      when 'overdue' then p.status in ('open', 'in_progress') and p.due_at < now()
      when 'closed' then p.status in ('done', 'rejected')
      else true end
    and (${kind}::text is null or p.kind::text = ${kind}::text)
    and (${pattern}::text is null
         or p.requester_name ilike ${pattern}::text escape '\\'
         or p.requester_email ilike ${pattern}::text escape '\\'
         or p.description ilike ${pattern}::text escape '\\'
         or p.organization_id::text ilike ${pattern}::text escape '\\')`;
  const [{ total }] = await sql()<{ total: number }[]>`select count(*)::int as total from platform.privacy_requests p where ${where}`;
  const page = clampPage(query.page ?? 1, total, LIST_PAGE_SIZE);
  const rows = await sql()<Raw[]>`
    select p.id, p.organization_id, o.name as space_name, p.requester_name, p.requester_email, p.kind, p.description,
           p.status, p.received_at, p.due_at, p.resolution, p.handled_by_name, p.closed_at
      from platform.privacy_requests p left join public.organizations o on o.id = p.organization_id
     where ${where}
     order by (p.status in ('open', 'in_progress')) desc, p.due_at asc, p.id
     limit ${LIST_PAGE_SIZE} offset ${(page - 1) * LIST_PAGE_SIZE}`;
  return { rows: rows.map(map), total, page };
}

export async function requestCounts(): Promise<{ pending: number; overdue: number }> {
  const [row] = await sql()<{ pending: number; overdue: number }[]>`
    select count(*) filter (where status in ('open', 'in_progress'))::int as pending,
           count(*) filter (where status in ('open', 'in_progress') and due_at < now())::int as overdue
      from platform.privacy_requests`;
  return row;
}

export async function createRequest(input: {
  organizationId: string | null;
  requesterName: string;
  requesterEmail: string;
  kind: RequestKind;
  description: string;
  adminName: string;
}): Promise<string> {
  const [row] = await sql()<{ id: string }[]>`
    insert into platform.privacy_requests (organization_id, requester_name, requester_email, kind, description, created_by_name)
    values (${input.organizationId}, ${input.requesterName}, ${input.requesterEmail}, ${input.kind}, ${input.description}, ${input.adminName})
    returning id`;
  return row.id;
}

export async function updateRequest(input: { id: string; status: RequestStatus; resolution: string; adminName: string }): Promise<{ before: RequestStatus }> {
  const closing = input.status === "done" || input.status === "rejected";
  if (closing && input.resolution.trim().length < 5) throw new PrivacyError("Descreva o que foi feito para concluir ou recusar.");
  const [prev] = await sql()<{ status: RequestStatus }[]>`select status from platform.privacy_requests where id = ${input.id}`;
  if (!prev) throw new PrivacyError("Pedido não encontrado.");
  await sql()`
    update platform.privacy_requests
       set status = ${input.status}, resolution = ${input.resolution.trim() || null}, handled_by_name = ${input.adminName},
           closed_at = ${closing ? new Date() : null}, updated_at = now()
     where id = ${input.id}`;
  return { before: prev.status };
}

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const pg = error as { code?: string; message?: string };
    if (pg.code === "22023" || pg.code === "P0002") throw new PrivacyError(pg.message ?? "Não foi possível concluir.");
    throw error;
  }
}

export async function setSpaceStatus(input: { organizationId: string; status: "active" | "inactive"; reason: string; admin: { id: string; name: string } }): Promise<void> {
  const { ip, userAgent } = await requestInfo();
  await call(
    () => sql()`select platform.set_space_status(${input.organizationId}, ${input.status}, ${input.reason}, ${input.admin.id}, ${input.admin.name}, ${ip}, ${userAgent})`,
  );
}

export async function exportSpace(input: { organizationId: string; reason: string; admin: { id: string; name: string } }): Promise<unknown> {
  const { ip, userAgent } = await requestInfo();
  return call(async () => {
    const [row] = await sql()<{ data: unknown }[]>`
      select platform.export_space(${input.organizationId}, ${input.reason}, ${input.admin.id}, ${input.admin.name}, ${ip}, ${userAgent}) as data`;
    return row.data;
  });
}
