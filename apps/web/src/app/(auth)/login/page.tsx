import { redirect } from "next/navigation";
import { PublicAuthShell } from "@/components/shared/public-auth-shell";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { firstAllowedRoute } from "@/components/layout/nav";
import { organizationModelById } from "@/mocks/store";
import { safeRedirectPath } from "@/lib/session";
import { validateSignupToken } from "../signup-actions";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    signup_token?: string;
    email?: string;
  }>;
}) {
  const { from, signup_token: signupToken, email: initialEmail } = await searchParams;

  // Se o usuario clicou num link de cadastro (?signup_token=...), valida o token
  // mesmo que exista um cookie de sessao anterior no navegador.
  const tokenValidation = signupToken
    ? await validateSignupToken(signupToken)
    : null;

  if (!signupToken) {
    const current = await getCurrentUser();
    if (current) {
      const model = organizationModelById(current.organizationId) ?? "classes";
      redirect(firstAllowedRoute(current, model));
    }
  }

  const target = safeRedirectPath(from) ?? "/dashboard";

  const title =
    tokenValidation?.status === "valid"
      ? "Crie sua senha"
      : tokenValidation?.status === "expired"
        ? "Link expirado"
        : tokenValidation?.status === "consumed"
          ? "Senha já cadastrada"
          : "Entrar";

  const subtitle =
    tokenValidation?.status === "valid"
      ? `Olá, ${tokenValidation.name.split(/\s+/)[0]}! Defina sua senha para concluir o cadastro e configurar seu espaço.`
      : tokenValidation?.status === "expired"
        ? "O link de criação de conta tem validade de 24 horas."
        : tokenValidation?.status === "consumed"
          ? "Sua conta já está criada. Digite sua senha para entrar."
          : "Acesse o painel da sua organização.";

  return (
    <PublicAuthShell title={title} subtitle={subtitle}>
      <LoginForm
        from={target}
        initialEmail={initialEmail}
        tokenValidation={tokenValidation}
      />
    </PublicAuthShell>
  );
}
