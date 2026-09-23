import { redirect } from "next/navigation";
import { PublicAuthShell } from "@/components/shared/public-auth-shell";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { firstAllowedRoute } from "@/components/layout/nav";
import { organizationModelById } from "@/mocks/store";
import { safeRedirectPath } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  // Ja logado com cookie VALIDO -> vai pra home do perfil. Cookie stale/invalido
  // (getCurrentUser null) cai no seletor e sera sobrescrito no proximo login,
  // evitando loop de redirect com o layout.
  const current = await getCurrentUser();
  if (current) {
    const model = organizationModelById(current.organizationId) ?? "scheduling";
    redirect(firstAllowedRoute(current, model));
  }

  const { from } = await searchParams;
  // So caminho relativo do app; o signIn revalida (permissao + modelo).
  const target = safeRedirectPath(from) ?? "/";

  return (
    <PublicAuthShell
      title="Entrar"
      subtitle="Acesse o painel da sua organização."
    >
      <LoginForm from={target} />
    </PublicAuthShell>
  );
}
