import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicAuthShell } from "@/components/shared/public-auth-shell";
import { secondFactorInfo } from "@/lib/security/second-factor";
import { maskEmail } from "@/lib/security/two-factor-rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/session";
import { TwoFactorForm } from "./two-factor-form";

export const metadata: Metadata = { title: "Verificação em duas etapas | GestaraHub" };

/** Codigo do aplicativo ou do e-mail depois da senha ou do Google (doc 17). */
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
  const info = user ? await secondFactorInfo(supabase, user) : null;
  if (!user || !info || info.state !== "missing") redirect("/login");

  return (
    <PublicAuthShell
      title="Verificação em duas etapas"
      subtitle="Falta só o código de 6 números para entrar."
    >
      <TwoFactorForm
        from={safeRedirectPath(from) ?? "/dashboard"}
        email={user.email ?? ""}
        maskedEmail={maskEmail(user.email ?? "")}
        hasApp={info.app}
        hasEmail={info.email}
      />
    </PublicAuthShell>
  );
}
