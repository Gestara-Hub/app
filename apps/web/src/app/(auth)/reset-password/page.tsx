import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";
import { PublicAuthShell } from "@/components/shared/public-auth-shell";
import { Button } from "@/components/ui/button";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkPasswordResetToken } from "@/services/server/passwordReset";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Criar nova senha | GestaraHub" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const check = await checkPasswordResetToken(createSupabaseAdminClient(), token);

  if (check.status !== "valid" || !token) {
    return (
      <PublicAuthShell title="Link vencido" subtitle="O link de nova senha vale por 1 hora e só uma vez.">
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground">
            <Clock className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <p>Este link venceu ou já foi usado. Peça outro para criar sua nova senha.</p>
          </div>
          <Button asChild className="w-full">
            <Link href="/forgot-password">Pedir outro link</Link>
          </Button>
        </div>
      </PublicAuthShell>
    );
  }

  return (
    <PublicAuthShell title="Criar nova senha" subtitle="Escolha uma senha com pelo menos 8 caracteres.">
      <ResetPasswordForm token={token} email={check.email} />
    </PublicAuthShell>
  );
}
