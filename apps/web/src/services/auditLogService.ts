import type {
  AuditAction,
  AuditChange,
  AuditLogEntry,
  AuditLogFilter,
  AuditTarget,
  UserProfile,
} from "@gestarahub/contracts";
import { getCurrentActor } from "@/mocks/currentActor";
import { newId, nowIso, simulateRead, textIncludes } from "@/mocks/helpers";
import { store } from "@/mocks/store";

function clone<T>(value: T): T {
  return structuredClone(value);
}

// Ator de fallback: mutacoes fora de uma sessao (ex.: seed/scripts) nao devem
// crashar a auditoria. Na pratica o SessionProvider ja publicou o ator logado.
const SYSTEM_ACTOR = { userId: "system", name: "Sistema", profile: "owner" } as const;

export interface RecordAuditInput {
  action: AuditAction;
  target: AuditTarget;
  // Predicado da frase (sem o autor): record() compoe "<autor> <predicado>".
  // Ex.: "cancelou o agendamento de Pedro Raul".
  predicate: string;
  changes?: AuditChange[];
  security?: boolean;
}

/**
 * Visibilidade de uma entrada para um espectador (aplicada no read-model, nunca
 * na UI). Owner ve tudo; Gerente ve os eventos operacionais e os eventos de
 * usuario cujo alvo seja Atendente/Profissional — eventos de Dono/Gerente e de
 * Configuracoes ficam so para o Dono. Demais perfis nem chegam aqui (a tela e
 * guardada pela capability `audit:view`).
 */
function canView(entry: AuditLogEntry, viewer: UserProfile): boolean {
  if (viewer === "owner") return true;
  if (viewer !== "manager") return false;
  if (!entry.security) return true;
  if (entry.target.type === "user") {
    return (
      entry.target.profile === "attendant" || entry.target.profile === "professional"
    );
  }
  return false;
}

export const auditLogService = {
  /**
   * Registra uma entrada append-only. Chamado DENTRO do `simulateWrite` do
   * service que fez a mutacao — assim a entrada e persistida junto. Sincrono e
   * a prova de falha: auditoria jamais derruba a operacao de negocio.
   */
  record(input: RecordAuditInput): void {
    try {
      const actor = getCurrentActor() ?? SYSTEM_ACTOR;
      const entry: AuditLogEntry = {
        id: newId(),
        organizationId: store.organization.id,
        unitId: store.unit.id,
        timestamp: nowIso(),
        actor: { userId: actor.userId, name: actor.name, profile: actor.profile },
        action: input.action,
        target: input.target,
        summary: `${actor.name} ${input.predicate}`,
        ...(input.changes && input.changes.length > 0 ? { changes: input.changes } : {}),
        security: input.security ?? false,
      };
      store.auditLog.push(entry);
    } catch {
      // Auditoria nunca propaga erro para a operacao de negocio.
    }
  },

  /** Lista o log visivel para o `viewer`, mais recente primeiro. */
  list(filter: AuditLogFilter | undefined, viewer: UserProfile): Promise<AuditLogEntry[]> {
    return simulateRead(() => {
      let result = store.auditLog.filter((e) => canView(e, viewer));
      if (filter?.entityType) {
        result = result.filter((e) => e.target.type === filter.entityType);
      }
      if (filter?.actorId) result = result.filter((e) => e.actor.userId === filter.actorId);
      if (filter?.security !== undefined) {
        result = result.filter((e) => e.security === filter.security);
      }
      if (filter?.dateFrom) result = result.filter((e) => e.timestamp >= filter.dateFrom!);
      if (filter?.dateTo) result = result.filter((e) => e.timestamp <= filter.dateTo!);
      if (filter?.search) {
        const term = filter.search;
        result = result.filter((e) => textIncludes(e.summary, term));
      }
      const sorted = [...result].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return clone(sorted);
    });
  },
};
