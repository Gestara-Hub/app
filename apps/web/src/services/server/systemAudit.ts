import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditAction, AuditActor, AuditChange, AuditTarget, UserProfile } from "@gestarahub/contracts";
import { logError } from "@/lib/log";

/**
 * Auditoria do que acontece sem pessoa (doc technical/23): rotina diaria,
 * avisos do parceiro de pagamentos, tarefas do sistema. Mesma tabela da
 * Auditoria das pessoas, com o autor "sistema", a origem tecnica e, se falhou,
 * o codigo do registro de erros. So o servidor grava (chave de servico).
 * Modulo so do servidor, sem "use server".
 */

export type SystemSource = "cron.daily" | "cron.online-payments" | "webhook.asaas" | "system";

/** Quem aparece como autor, por origem. */
const SYSTEM_NAMES: Record<SystemSource, string> = {
  "cron.daily": "Rotina diária",
  "cron.online-payments": "Rotina de pagamentos online",
  "webhook.asaas": "Parceiro de pagamentos",
  system: "Sistema",
};

export function systemActor(source: SystemSource): AuditActor {
  return { kind: "system", userId: "system", name: SYSTEM_NAMES[source], profile: "owner" };
}

/** Autor pessoa, para gravacoes do servidor feitas a pedido de alguem. */
export async function userActor(
  admin: SupabaseClient,
  ctx: { organizationId: string; userId: string; profile: UserProfile },
): Promise<AuditActor> {
  const { data } = await admin.from("users").select("name").eq("id", ctx.userId).eq("organization_id", ctx.organizationId).maybeSingle();
  return { userId: ctx.userId, name: String(data?.name ?? "Usuário"), profile: ctx.profile };
}

export interface ServerAuditInput {
  organizationId: string;
  actor: AuditActor;
  /** Origem tecnica (sem pessoa). */
  source?: SystemSource;
  action: AuditAction;
  target: AuditTarget;
  /** Frase sem o autor: "confirmou o Pix de Ana Souza". */
  predicate: string;
  changes?: AuditChange[];
  security?: boolean;
  failed?: boolean;
  errorReference?: string;
}

/**
 * Grava uma linha na Auditoria pelo servidor. Devolve o id (para ligar a outro
 * registro), ou `undefined` se a gravacao falhar: auditoria nunca derruba a
 * operacao de negocio.
 */
export async function recordServerAudit(admin: SupabaseClient, input: ServerAuditInput): Promise<string | undefined> {
  const id = randomUUID();
  try {
    const { error } = await admin.from("audit_logs").insert({
      id,
      organization_id: input.organizationId,
      timestamp: new Date().toISOString(),
      actor: input.actor,
      action: input.action,
      target: input.target,
      summary: `${input.actor.name} ${input.predicate}`.trim(),
      changes: input.changes && input.changes.length > 0 ? input.changes : null,
      security: input.security === true,
      source: input.source ?? null,
      failed: input.failed === true,
      error_reference: input.errorReference ?? null,
    });
    if (error) {
      logError("[systemAudit] Auditoria não gravada:", error.message);
      return undefined;
    }
    return id;
  } catch (error) {
    logError("[systemAudit] Auditoria não gravada:", error);
    return undefined;
  }
}

/** Atalho para o sistema como autor. */
export function recordSystemAudit(
  admin: SupabaseClient,
  source: SystemSource,
  input: Omit<ServerAuditInput, "actor" | "source">,
): Promise<string | undefined> {
  return recordServerAudit(admin, { ...input, actor: systemActor(source), source });
}
