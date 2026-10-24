import "server-only";
import { sql } from "./db";
import { requestInfo } from "./request";

/**
 * "Entrar como suporte" (doc technical/26, fase 8): visao somente leitura de um
 * espaco, com motivo e 30 minutos, so de configuracao e totais (nenhum dado
 * pessoal de aluno). Abrir registra na Auditoria do espaco e na do painel.
 */
export class SupportAccessError extends Error {}

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const pg = error as { code?: string; message?: string };
    if (pg.code === "22023" || pg.code === "P0002") throw new SupportAccessError(pg.message ?? "Não foi possível concluir.");
    throw error;
  }
}

export async function startAccess(input: { organizationId: string; reason: string; admin: { id: string; name: string } }): Promise<string> {
  const { ip, userAgent } = await requestInfo();
  return call(async () => {
    const [row] = await sql()<{ id: string }[]>`
      select platform.start_support_access(${input.organizationId}, ${input.reason}, ${input.admin.id}, ${input.admin.name}, ${ip}, ${userAgent})::text as id`;
    return row.id;
  });
}

export async function endAccess(sessionId: string, admin: { id: string; name: string }): Promise<void> {
  const { ip, userAgent } = await requestInfo();
  await sql()`select platform.end_support_access(${sessionId}, ${admin.id}, ${admin.name}, ${ip}, ${userAgent})`;
}

export interface SupportSnapshot {
  organizationId: string;
  expiresAt: string;
  space: {
    name: string;
    model: string;
    area: string | null;
    customArea: string | null;
    status: string;
    createdAt: string;
    subscription: Record<string, unknown> | null;
    timeZone: string | null;
    onlinePayments: string;
  };
  units: number;
  people: Record<string, number>;
  owner: { termsVersion: string | null; termsAcceptedAt: string | null } | null;
  students: Record<string, number>;
  professionals: Record<string, number>;
  enrollments: Record<string, number>;
  classes: { name: string; status: string; capacity: number | null; enrolled: number; billingMode: string | null; slots: number }[];
  plans: { name: string; priceCents: number; period: string; status: string }[];
  charges: { competence: string; status: string; count: number; totalCents: number }[];
  onlinePaymentsByStatus: Record<string, number>;
}

export async function loadSnapshot(sessionId: string, adminId: string): Promise<SupportSnapshot> {
  return call(async () => {
    const [row] = await sql()<{ data: SupportSnapshot }[]>`select platform.support_view(${sessionId}, ${adminId}) as data`;
    return row.data;
  });
}

/** Visoes abertas por esta pessoa nos ultimos dias (para voltar a uma que ainda vale). */
export async function openAccess(adminId: string): Promise<{ id: string; organizationId: string; spaceName: string; expiresAt: Date } | null> {
  const [row] = await sql()<{ id: string; organization_id: string; name: string; expires_at: Date }[]>`
    select s.id, s.organization_id, o.name, s.expires_at
      from platform.support_access_sessions s join public.organizations o on o.id = s.organization_id
     where s.admin_id = ${adminId} and s.ended_at is null and s.expires_at > now()
     order by s.started_at desc limit 1`;
  return row ? { id: row.id, organizationId: row.organization_id, spaceName: row.name, expiresAt: row.expires_at } : null;
}
