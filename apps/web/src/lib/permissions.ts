import type { Permission, User, UserProfile } from "@/types";

/**
 * Lista completa de permissoes. Usada como conjunto do perfil "owner" e
 * checada em tempo de compilacao para cobrir toda a uniao `Permission` (assim
 * o proprietario nunca perde uma acao silenciosamente ao adicionarmos keys).
 */
const ALL_PERMISSIONS = [
  "dashboard:view",
  "schedule:view",
  "appointments:view",
  "appointments:create",
  "appointments:edit",
  "appointments:cancel",
  "appointments:reschedule",
  "appointments:status",
  "appointments:block",
  "recurrence:manage",
  "clients:view",
  "clients:manage",
  "team:view",
  "team:manage",
  "services:view",
  "services:manage",
  "settings:view",
  "users:view",
  "users:manage",
] as const satisfies readonly Permission[];

// Erro de compilacao se ALL_PERMISSIONS deixar de cobrir alguma `Permission`.
type _Uncovered = Exclude<Permission, (typeof ALL_PERMISSIONS)[number]>;
const _assertExhaustive: _Uncovered extends never ? true : false = true;
void _assertExhaustive;

/**
 * Matriz perfil -> permissoes (fonte unica do RBAC; espelha doc 06). Mapeia
 * direto para policies/scopes do backend real.
 */
export const PROFILE_PERMISSIONS: Record<UserProfile, readonly Permission[]> = {
  owner: ALL_PERMISSIONS,
  manager: [
    "dashboard:view",
    "schedule:view",
    "appointments:view",
    "appointments:create",
    "appointments:edit",
    "appointments:cancel",
    "appointments:reschedule",
    "appointments:status",
    "appointments:block",
    "recurrence:manage",
    "clients:view",
    "clients:manage",
    "team:view",
    "team:manage",
    "services:view",
    "services:manage",
  ],
  attendant: [
    "schedule:view",
    "appointments:view",
    "appointments:create",
    "appointments:edit",
    "appointments:cancel",
    "appointments:reschedule",
    "appointments:status",
    "recurrence:manage",
    "clients:view",
    "clients:manage",
    "team:view",
    "services:view",
  ],
  professional: [
    "schedule:view",
    "appointments:view",
    "appointments:status",
    "clients:view",
    "services:view",
    "team:view",
  ],
};

/**
 * O perfil/usuario tem a permissao? Aceita um `UserProfile` (server/proxy) ou
 * um objeto com `profile` (usuario logado no client).
 */
export function can(
  subject: UserProfile | Pick<User, "profile">,
  permission: Permission,
): boolean {
  const profile = typeof subject === "string" ? subject : subject.profile;
  return PROFILE_PERMISSIONS[profile].includes(permission);
}
