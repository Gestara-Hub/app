import {
  paginateArray,
  type AuditAction,
  type AuditChange,
  type AuditLogEntry,
  type AuditLogFilter,
  type AuditTarget,
  type PaginatedResult,
  type UserProfile,
} from "@gestarahub/contracts";
import { getCurrentActor } from "@/services/world/actor";
import { newId, nowIso, readOp, textIncludes } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { realAccountInBrowser } from "../world/delegate";
import { listAuditLogPage, recordAuditLogInDb } from "./auditLogBackend";
import { logError } from "@/lib/log";

/** Eventos por pagina na tela de auditoria. */
export const AUDIT_PAGE_SIZE = 50;

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
   * Registra uma entrada append-only. Chamado DENTRO do `writeOp` do
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

      if (realAccountInBrowser()) {
        // So o que aconteceu; autor, espaco e hora o servidor tira da sessao.
        recordAuditLogInDb({ ...input, unitId: store.unit.id }).catch((err) => {
          logError("[auditLogService] Erro ao persistir log:", err);
        });
      }
    } catch {
      // Auditoria nunca propaga erro para a operacao de negocio.
    }
  },

  /**
   * Uma pagina do log visivel, mais recente primeiro (doc 19, fase 3). Conta
   * real: filtros, visibilidade e paginacao no banco, com o perfil da sessao
   * (`viewer` so vale no espaco local).
   */
  listPage(
    filter: AuditLogFilter | undefined,
    viewer: UserProfile,
    page = 1,
    pageSize = AUDIT_PAGE_SIZE,
  ): Promise<PaginatedResult<AuditLogEntry>> {
    return readOp(async () => {
      if (realAccountInBrowser()) return listAuditLogPage(filter, page, pageSize);

      let result = store.auditLog.filter((e) => canView(e, viewer));
      if (filter?.entityType) {
        result = result.filter((e) => e.target.type === filter.entityType);
      }
      if (filter?.actorId) result = result.filter((e) => e.actor.userId === filter.actorId);
      if (filter?.security !== undefined) {
        result = result.filter((e) => e.security === filter.security);
      }
      if (filter?.dateFrom) {
        const fromISO = filter.dateFrom.length === 10 ? `${filter.dateFrom}T00:00:00.000Z` : filter.dateFrom;
        result = result.filter((e) => e.timestamp >= fromISO);
      }
      if (filter?.dateTo) {
        const toISO = filter.dateTo.length === 10 ? `${filter.dateTo}T23:59:59.999Z` : filter.dateTo;
        result = result.filter((e) => e.timestamp <= toISO);
      }
      if (filter?.search) {
        const term = filter.search;
        result = result.filter((e) => textIncludes(e.summary, term));
      }
      const sorted = [...result].sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id));
      return clone(paginateArray(sorted, page, pageSize));
    });
  },
};
