import { PublicAuthShell } from "@/components/shared/public-auth-shell";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const target = from && from.startsWith("/") ? from : "/";

  return (
    <PublicAuthShell
      title="Entrar"
      subtitle="Acesse o painel da sua organização."
    >
      <LoginForm from={target} />
    </PublicAuthShell>
  );
}
