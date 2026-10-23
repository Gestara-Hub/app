"use server";

import { headers } from "next/headers";
import { sendPasswordResetEmail } from "@/lib/email/mailersend";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  MIN_PASSWORD_LENGTH,
  createPasswordResetToken,
  discardPasswordResetToken,
  resetPasswordWithToken,
} from "@/services/server/passwordReset";
import { logError } from "@/lib/log";

async function resolveAppBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin.replace(/\/+$/, "");
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * "Esqueci minha senha": manda o link se o e-mail tem conta com senha. A
 * resposta e a mesma com ou sem conta (nao revela quais e-mails existem).
 */
export async function requestPasswordResetAction(input: {
  email: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Informe um e-mail válido." };
  }

  const ip = await getClientIp();
  const allowedIp = await checkRateLimit({ key: `password_reset_ip:${ip}`, maxRequests: 5, windowSeconds: 600 });
  const allowedEmail = await checkRateLimit({
    key: `password_reset_email:${email}`,
    maxRequests: 3,
    windowSeconds: 900,
  });
  if (!allowedIp || !allowedEmail) {
    return { ok: false, message: "Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo." };
  }

  try {
    const admin = createSupabaseAdminClient();
    const created = await createPasswordResetToken(admin, email);
    if (created) {
      const resetUrl = `${await resolveAppBaseUrl()}/reset-password?token=${created.token}`;
      const sent = await sendPasswordResetEmail({ toEmail: created.email, toName: created.name, resetUrl });
      if (!sent.ok) {
        await discardPasswordResetToken(admin, created.token);
        return { ok: false, message: sent.error };
      }
    }
    return { ok: true };
  } catch (err) {
    logError("[password-reset] Erro ao pedir o link:", err);
    return { ok: false, message: "Não foi possível enviar agora. Tente novamente." };
  }
}

/** Troca a senha pelo link do e-mail; depois a pessoa entra com a nova senha. */
export async function completePasswordResetAction(input: {
  token: string;
  password: string;
}): Promise<{ ok: true; email: string } | { ok: false; message: string; expired?: boolean }> {
  const ip = await getClientIp();
  if (!(await checkRateLimit({ key: `password_reset_complete:${ip}`, maxRequests: 10, windowSeconds: 600 }))) {
    return { ok: false, message: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }
  const result = await resetPasswordWithToken(createSupabaseAdminClient(), input.token, input.password);
  if (result.ok) return { ok: true, email: result.email };
  switch (result.code) {
    case "weak":
      return { ok: false, message: `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` };
    case "expired":
    case "invalid":
      return { ok: false, message: "Este link venceu ou já foi usado. Peça outro.", expired: true };
    default:
      return { ok: false, message: "Não foi possível trocar a senha. Tente novamente." };
  }
}
