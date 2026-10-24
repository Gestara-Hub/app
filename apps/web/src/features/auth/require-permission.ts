import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { firstAllowedRoute, isRouteInModel } from "@/components/layout/nav";
import { organizationModelById } from "@/mocks/store";
import type { Permission, UserView } from "@gestarahub/contracts";
import { getCurrentUser } from "./get-current-user";

/**
 * Guarda de rota server-side (backstop do gating de UI). Sem usuario -> login;
 * sem permissao OU rota de outro modelo operacional (ex.: /classes/billing num
 * tenant de agenda) -> primeira rota acessivel do perfil no modelo (evita loop
 * quando o usuario nao pode ver `/`). Chamar no topo da page server protegida,
 * passando a rota da nav (`route`) para checar o modelo do tenant.
 */
export async function requirePermission(
  permission: Permission | readonly Permission[],
  route: string,
): Promise<UserView> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const model = organizationModelById(user.organizationId) ?? "scheduling";
  const allowed = (Array.isArray(permission) ? permission : [permission]) as readonly Permission[];
  if (!isRouteInModel(route, model) || !allowed.some((p) => can(user, p))) {
    redirect(firstAllowedRoute(user, model));
  }
  return user;
}
