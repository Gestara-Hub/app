import type { Permission, User, UserProfile } from "@/types";

/**
 * Blocos de capacidade reutilizaveis. Cada permissao e declarada uma unica vez
 * aqui e composta (spread) nos perfis abaixo — assim, mudar a terminologia de
 * uma key reflete em todos os perfis que a usam, sem risco de divergencia ou
 * erro de digitacao entre perfis.
 */

// Leitura das secoes operacionais — base comum a todo perfil que opera.
const OPERATIONAL_VIEWS = [
  "schedule:view",
  "clients:view",
  "services:view",
  "team:view",
] as const satisfies readonly Permission[];

// Operar a agenda: criar/editar/remarcar/cancelar, mudar status e series.
const APPOINTMENT_OPS = [
  "appointments:create",
  "appointments:edit",
  "appointments:cancel",
  "appointments:reschedule",
  "appointments:status",
  "recurrence:manage",
] as const satisfies readonly Permission[];

/**
 * Lista completa de permissoes. Conjunto do perfil "owner" e ancora da
 * verificacao de exaustividade abaixo (garante que nenhuma key nova fique de
 * fora silenciosamente). Composta dos mesmos blocos + as keys exclusivas.
 */
const ALL_PERMISSIONS = [
  "dashboard:view",
  ...OPERATIONAL_VIEWS,
  ...APPOINTMENT_OPS,
  "appointments:block",
  "clients:manage",
  "team:manage",
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
 * direto para policies/scopes do backend real. Cada perfil compoe os blocos
 * acima e adiciona so o que lhe e exclusivo.
 */
export const PROFILE_PERMISSIONS: Record<UserProfile, readonly Permission[]> = {
  owner: ALL_PERMISSIONS,
  manager: [
    "dashboard:view",
    ...OPERATIONAL_VIEWS,
    ...APPOINTMENT_OPS,
    "appointments:block",
    "clients:manage",
    "team:manage",
    "services:manage",
  ],
  attendant: [...OPERATIONAL_VIEWS, ...APPOINTMENT_OPS, "clients:manage"],
  professional: [...OPERATIONAL_VIEWS, "appointments:status"],
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
