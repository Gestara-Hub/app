import type { DateTimeISO, Id } from "./common";
import type { UserProfile } from "./user";

/**
 * Log de auditoria: registro imutavel (append-only) de QUEM fez O QUE e QUANDO.
 * Gerado sempre na camada de service (o seam que imita a API) em cada mutacao —
 * nunca disparado pela UI, para nao ser burlavel. Espelha o que um interceptor
 * do NestJS gravaria no backend real.
 *
 * Visibilidade (aplicada no read-model, ver services/auditLogService):
 * - owner: tudo;
 * - manager: eventos operacionais (security=false) + eventos de usuario cujo
 *   alvo tenha perfil Atendente/Profissional; eventos de Dono/Gerente e de
 *   Configuracoes ficam so para o owner;
 * - attendant/professional: sem a capability `audit:view`, nao acessam a tela.
 */

// Acao registrada. Codigos em ingles; rotulos PT via `auditActionLabel`.
export type AuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "cancelled" // agendamento cancelado
  | "rescheduled" // agendamento remarcado
  | "status_changed" // mudanca de status do agendamento
  | "activated" // cadastro reativado
  | "inactivated"; // cadastro inativado

// Tipo da entidade alvo do evento. `settings` cobre o expediente da unidade.
export type AuditEntityType =
  | "appointment"
  | "client"
  | "service"
  | "category"
  | "role"
  | "professional"
  | "user"
  | "settings";

// Autor do evento (snapshot no momento — nome/perfil podem mudar depois).
export interface AuditActor {
  userId: Id;
  name: string;
  profile: UserProfile;
}

// Alvo do evento (snapshot do rotulo para exibir sem novo join). `profile` so
// e preenchido quando `type === "user"` — e o que filtra a visao do gerente.
export interface AuditTarget {
  type: AuditEntityType;
  id?: Id;
  label: string; // ex.: "Corte Masculino", "Pedro Raul"
  profile?: UserProfile;
}

// Alteracao de um campo (antes -> depois), ja formatada para leitura. Registrada
// apenas onde importa para disputa (preco, horario do agendamento, permissao).
export interface AuditChange {
  field: string; // codigo do campo, ex.: "priceCents", "start"
  label: string; // rotulo PT, ex.: "Preco"
  before: string; // valor formatado, ex.: "R$ 40,00"
  after: string;
}

export interface AuditLogEntry {
  id: Id;
  organizationId: Id;
  unitId: Id;
  timestamp: DateTimeISO;
  actor: AuditActor;
  action: AuditAction;
  target: AuditTarget;
  // Resumo pronto em PT para a linha da tabela (ex.:
  // "Marcelo cancelou o agendamento de Pedro Raul").
  summary: string;
  // Detalhe antes->depois, so nos eventos que valem.
  changes?: AuditChange[];
  // Etiqueta o subconjunto sensivel (usuarios/permissoes/configuracoes) — dirige
  // a restricao de visibilidade do gerente.
  security: boolean;
}

export interface AuditLogFilter {
  entityType?: AuditEntityType;
  actorId?: Id;
  dateFrom?: DateTimeISO;
  dateTo?: DateTimeISO;
  security?: boolean;
  search?: string; // casa contra o summary
}
