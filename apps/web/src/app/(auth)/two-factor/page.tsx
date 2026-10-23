import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicAuthShell } from "@/components/shared/public-auth-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/session";
import { needsSecondFactor } from "../sign-in-session";
import { TwoFactorForm } from "./two-factor-form";

export const metadata: Metadata = { title: "Verificação em duas etapas | GestaraHub" };

/** Codigo do aplicativo depois da senha ou do Google (doc 17). */
export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Sem sessao esperando o codigo (aberta direto ou ja verificada): volta ao login.
  if (!user || !(await needsSecondFactor(supabase))) redirect("/login");

  return (
    <PublicAuthShell
      title="Verificação em duas etapas"
      subtitle="Digite o código de 6 números do seu aplicativo autenticador."
    >
      <TwoFactorForm from={safeRedirectPath(from) ?? "/dashboard"} email={user.email ?? ""} />
    </PublicAuthShell>
  );
}
