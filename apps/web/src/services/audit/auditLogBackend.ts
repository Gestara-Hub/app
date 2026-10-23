"use server";

import { randomUUID } from "node:crypto";
import type { AuditLogEntry, AuditLogFilter, PaginatedResult } from "@gestarahub/contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenant } from "../server/tenant";
import { auditLogPageFor } from "./auditLogPage";
import type { RecordAuditInput } from "./auditLogService";

/** Limites do que vem do navegador (texto livre na auditoria). */
const MAX_TEXT = 500;
const MAX_CHANGES = 50;

function text(value: unknown, max = MAX_TEXT): string | undefined {
  return typeof value === "string" ? value.slice(0, max) : undefined;
}

/**
 * Grava um evento de auditoria de uma acao que rodou no navegador (os metodos
 * que nao passam pelo servidor). O navegador so diz O QUE aconteceu (acao,
 * alvo, frase sem o autor, mudancas); QUEM fez, o espaco, a hora e o id saem
 * da sessao no servidor. Antes o evento vinha inteiro do navegador: quem
 * estivesse logado gravava no proprio espaco um evento em nome de outra pessoa.
 * Grava com a chave de servico (a sessao nao tem mais permissao de inserir,
 * migracao 44). Auditoria nunca derruba a operacao: erro so vai para o log.
 */
export async function recordAuditLogInDb(input: RecordAuditInput & { unitId?: string }): Promise<void> {
  try {
    const ctx = await requireTenant();
    const admin = createSupabaseAdminClient();
    const [{ data: user }, { data: unit }] = await Promise.all([
      admin.from("users").select("name").eq("id", ctx.userId).eq("organization_id", ctx.organizationId).maybeSingle(),
      input.unitId
        ? admin.from("units").select("id").eq("id", input.unitId).eq("organization_id", ctx.organizationId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const name = String(user?.name ?? "Usuário");
    const target = input.target ?? ({} as RecordAuditInput["target"]);
    const { error } = await admin.from("audit_logs").insert({
      id: randomUUID(),
      organization_id: ctx.organizationId,
      unit_id: unit?.id ?? null,
      timestamp: new Date().toISOString(),
      actor: { userId: ctx.userId, name, profile: ctx.profile },
      action: text(input.action, 40),
      target: {
        type: text(target.type, 40),
        ...(text(target.id, 100) ? { id: text(target.id, 100) } : {}),
        label: text(target.label) ?? "",
        ...(text(target.profile, 40) ? { profile: text(target.profile, 40) } : {}),
      },
      summary: `${name} ${text(input.predicate) ?? ""}`.trim(),
      changes: Array.isArray(input.changes) && input.changes.length > 0 ? input.changes.slice(0, MAX_CHANGES) : null,
      security: input.security === true,
    });
    if (error) console.error("[auditLogBackend] Erro ao gravar audit log:", error.message);
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
