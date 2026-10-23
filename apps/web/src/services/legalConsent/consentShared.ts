import crypto from "node:crypto";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendWelcomeEmail } from "@/lib/email/mailersend";
import { logError, logWarn } from "@/lib/log";

/**
 * Apoio dos aceites (so servidor): hash do texto aceito, endereco do app e boas-vindas no primeiro aceite.
 */

/**
 * Calcula o hash SHA-256 do documento para garantia de integridade probatória perante a ANPD / Judiciário.
 */
export function computeTermsDocumentHash(
  version: string,
  content = `GestaraHub Platform Terms of Use and Privacy Policy (LGPD) - Version ${version}`,
): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

export async function resolveAppBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin.replace(/\/+$/, "");
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Dominios reservados (demonstracao e e2e): nunca recebem e-mail de verdade. */
export const RESERVED_EMAIL_DOMAIN = /\.(test|example|invalid|localhost)$/i;

/** Boas-vindas so no 1o aceite dos termos e so para o dono do espaco. */
export async function sendWelcomeOnFirstAcceptance(userId: string, appUrl: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const [{ data: dbUser }, { count }] = await Promise.all([
      admin.from("users").select("name, email, profile").eq("id", userId).maybeSingle(),
      admin
        .from("legal_consents")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("consent_type", "platform_terms"),
    ]);
    if (!dbUser?.email || dbUser.profile !== "owner" || count !== 1) return;
    if (RESERVED_EMAIL_DOMAIN.test(dbUser.email as string)) return;
    const sent = await sendWelcomeEmail({
      toEmail: dbUser.email as string,
      toName: (dbUser.name as string) || "",
      appUrl,
    });
    if (!sent.ok) logWarn("[recordLegalConsentAction] Boas-vindas não enviadas:", sent.error);
  } catch (err) {
    logError("[recordLegalConsentAction] Erro ao enviar boas-vindas:", err);
  }
}
