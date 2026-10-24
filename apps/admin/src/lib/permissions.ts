/**
 * Papeis do painel e o que cada um pode (doc technical/26, secao 3). Fonte unica
 * do RBAC da plataforma, separada de `@/lib/permissions` do app dos clientes:
 * quem e administrador nunca e usuario de um espaco.
 */

export const ADMIN_ROLES = ["platform_owner", "platform_support", "platform_finance", "platform_viewer"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  platform_owner: "Proprietário",
  platform_support: "Suporte",
  platform_finance: "Financeiro",
  platform_viewer: "Leitura",
};

export type AdminPermission =
  | "dashboard:view"
  | "spaces:view"
  | "support:view"
  | "support:reply"
  | "plans:view"
  | "plans:grant"
  | "health:view"
  | "revenue:view"
  | "announcements:manage"
  | "team:view"
  | "team:manage"
  | "audit:view"
  | "lgpd:manage"
  | "settings:manage";

const OWNER: readonly AdminPermission[] = [
  "dashboard:view",
  "spaces:view",
  "support:view",
  "support:reply",
  "plans:view",
  "plans:grant",
  "health:view",
  "revenue:view",
  "announcements:manage",
  "team:view",
  "team:manage",
  "audit:view",
  "lgpd:manage",
  "settings:manage",
];

export const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  platform_owner: OWNER,
  platform_support: ["dashboard:view", "spaces:view", "support:view", "support:reply", "health:view", "announcements:manage"],
  platform_finance: ["dashboard:view", "spaces:view", "plans:view", "plans:grant", "revenue:view"],
  platform_viewer: ["dashboard:view", "spaces:view", "plans:view", "health:view", "revenue:view"],
};

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

export function can(role: AdminRole | undefined, permission: AdminPermission): boolean {
  return role ? ROLE_PERMISSIONS[role].includes(permission) : false;
}
