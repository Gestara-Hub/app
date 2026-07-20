import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { firstAllowedRoute } from "@/components/layout/nav";
import { organizationModelById } from "@/mocks/store";
import type { Permission, UserView } from "@gestarahub/contracts";
import { getCurrentUser } from "./get-current-user";

/**
 * Guarda de rota server-side (backstop do gating de UI). Sem usuario -> login;
 * sem permissao -> primeira rota acessivel do perfil (evita loop quando o
 * usuario nao pode ver `/`). Chamar no topo da page server protegida.
 */
export async function requirePermission(
  permission: Permission,
): Promise<UserView> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, permission)) {
    const model = organizationModelById(user.organizationId) ?? "scheduling";
    redirect(firstAllowedRoute(user, model));
  }
  return user;
}
