/**
 * Taxonomia de permissoes (capability keys) no formato `entity:action`.
 * Fonte unica das acoes do sistema; mapeiam 1:1 a scopes de uma API real.
 * O perfil (UserProfile) deriva o conjunto de permissoes via
 * `PROFILE_PERMISSIONS` (lib/permissions), e a UI checa com `can()` — nunca
 * compara `profile === '...'` diretamente.
 */
export type Permission =
  | "dashboard:view"
  | "schedule:view"
  | "appointments:view"
  | "appointments:create"
  | "appointments:edit"
  | "appointments:cancel"
  | "appointments:reschedule"
  | "appointments:status" // confirmar / iniciar / concluir / nao compareceu
  | "appointments:block" // criar bloqueios de horario (Admin + Gerente)
  | "recurrence:manage" // criar/editar series recorrentes
  | "clients:view"
  | "clients:manage" // criar/editar/inativar clientes
  | "team:view"
  | "team:manage" // criar/editar/inativar profissionais + cargos
  | "services:view"
  | "services:manage" // criar/editar/inativar servicos + categorias
  | "settings:view"
  | "users:view" // reservado (gestao de usuarios — fora do MVP)
  | "users:manage"; // reservado (gestao de usuarios — fora do MVP)
