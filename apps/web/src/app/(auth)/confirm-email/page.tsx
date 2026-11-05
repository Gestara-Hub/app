import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";
import { PublicAuthShell } from "@/components/shared/public-auth-shell";
import { Button } from "@/components/ui/button";
import { maskEmail } from "@/lib/security/two-factor-rules";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { accountNeedsPassword, checkEmailChangeToken } from "@/services/server/emailChange";
import { ConfirmEmailForm } from "./confirm-email-form";

export const metadata: Metadata = { title: "Confirmar novo e-mail | GestaraHub" };
export const dynamic = "force-dynamic";

/**
 * Link do e-mail novo na troca do e-mail de acesso (05/11/2026). Abrir a
 * pagina nao confirma: o botao confirma (o leitor de links do e-mail abre a
 * mensagem sozinho). Rota publica: o e-mail novo sai mascarado.
 */
export default async function ConfirmEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const admin = createSupabaseAdminClient();
  const check = await checkEmailChangeToken(admin, token);

  if (check.status !== "valid" || !token) {
    return (
      <PublicAuthShell title="Link vencido" subtitle="O link de troca de e-mail vale por 1 hora e só uma vez.">
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground">
            <Clock className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <p>Este link venceu ou já foi usado. Peça a troca de novo no menu da sua conta.</p>
          </div>
          <Button asChild className="w-full">
            <Link href="/login">Ir para o login</Link>
          </Button>
        </div>
      </PublicAuthShell>
    );
  }

  // Quem entrava so pelo Google cria a senha aqui (o Google antigo deixa de entrar).
  const needsPassword = await accountNeedsPassword(admin, check.authUserId);
  return (
    <PublicAuthShell
      title="Confirmar novo e-mail"
      subtitle={needsPassword ? "Crie uma senha para entrar com o e-mail novo." : "Depois de confirmar, você entra com o e-mail novo."}
    >
      <ConfirmEmailForm token={token} maskedNewEmail={maskEmail(check.newEmail)} needsPassword={needsPassword} />
    </PublicAuthShell>
  );
}
