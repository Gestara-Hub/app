import type { UserProfile } from "@gestarahub/contracts";

/**
 * Espaco de demonstracao no banco (doc 15, fatia 4), criado por
 * `pnpm demo:local` (apps/web/scripts/demo). Um usuario por perfil; a senha
 * vem de DEMO_PASSWORD no servidor.
 */
export const DEMO_ORGANIZATION_ID = "de300000-0000-4000-8000-000000000001";

export const DEMO_USERS: { profile: UserProfile; name: string; email: string }[] = [
  { profile: "owner", name: "Ana Ribeiro", email: "dono@demo.gestarahub.test" },
  { profile: "manager", name: "Paulo Siqueira", email: "gerente@demo.gestarahub.test" },
  { profile: "attendant", name: "Renata Alves", email: "recepcao@demo.gestarahub.test" },
  { profile: "professional", name: "Rodrigo Mendes", email: "professor@demo.gestarahub.test" },
];

export function isDemoOrganization(organizationId: string | undefined): boolean {
  return organizationId === DEMO_ORGANIZATION_ID;
}
