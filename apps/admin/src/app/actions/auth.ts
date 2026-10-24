"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminContext } from "@/lib/server/context";
import { recordAudit } from "@/lib/server/audit";
import { sql } from "@/lib/server/db";
import { getEnv } from "@/lib/server/env";
import { allow, reset } from "@/lib/server/rate-limit";
import { requestInfo } from "@/lib/server/request";
import { createAuthClient } from "@/lib/server/supabase";
import { safeNext } from "@/lib/safe-redirect";
import { SESSION_MAX_AGE_SECONDS, SESSION_STARTED_COOKIE, signSessionStart } from "@/lib/session-token";

export interface FormState {
  error?: string;
}

const GENERIC_LOGIN_ERROR = "E-mail ou senha incorretos.";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

/**
 * Entrada no painel (passo 1): senha. So passa quem tem o marcador de
 * plataforma E uma linha ativa em `platform.admins`; qualquer outra conta
 * (inclusive usuario de espaco) recebe a mesma mensagem de senha errada, sem
 * dizer que existe. O segundo fator vem em /mfa.
 */
export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Informe seu e-mail e sua senha." };
  const { email, password } = parsed.data;
  const next = safeNext(String(formData.get("next") ?? ""));

  const { ip } = await requestInfo();
  const limitKey = `login:${ip}:${email}`;
  if (!(await allow(limitKey, 5, 60))) {
    return { error: "Muitas tentativas. Aguarde 1 minuto antes de tentar de novo." };
  }

  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  const user = data?.user;
  if (error || !user) {
    await recordAudit({ admin: null, action: "auth.login_failed", target: { email, reason: "senha" } });
    return { error: GENERIC_LOGIN_ERROR };
  }

  const rows = await sql()<{ id: string; name: string }[]>`
    select id, name from platform.admins where auth_user_id = ${user.id} and status = 'active'`;
  if (user.app_metadata?.platform !== true || !rows[0]) {
    // Conta valida, mas nao e administradora: sai na hora e nada fica aberto.
    await supabase.auth.signOut();
    await recordAudit({ admin: null, action: "auth.login_denied", target: { email, reason: "nao_e_admin" } });
    return { error: GENERIC_LOGIN_ERROR };
  }

  (await cookies()).set(SESSION_STARTED_COOKIE, signSessionStart(getEnv().ADMIN_SESSION_SECRET, user.id, Date.now()), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  await reset(limitKey);
  redirect(`/mfa${next === "/" ? "" : `?next=${encodeURIComponent(next)}`}`);
}

const codeSchema = z.object({ factorId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) });

/**
 * Segundo fator (passo 2): codigo do app autenticador. Serve para confirmar o
 * primeiro cadastro do app e para as proximas entradas. Sem isso a sessao
 * fica em AAL1 e o painel nao abre.
 */
export async function verifyMfaAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getAdminContext();
  if (ctx.stage === "anonymous") redirect("/login");
  if (ctx.stage === "ok") redirect("/");

  const parsed = codeSchema.safeParse({
    factorId: formData.get("factorId"),
    code: String(formData.get("code") ?? "").replace(/\s/g, ""),
  });
  if (!parsed.success) return { error: "Digite os 6 números do aplicativo." };
  const next = safeNext(String(formData.get("next") ?? ""));

  const limitKey = `mfa:${ctx.user.id}`;
  if (!(await allow(limitKey, 5, 60))) {
    return { error: "Muitas tentativas. Aguarde 1 minuto antes de tentar de novo." };
  }

  const supabase = await createAuthClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.all.find((f) => f.id === parsed.data.factorId && f.factor_type === "totp");
  if (!factor) return { error: "Este código de configuração venceu. Recarregue a página e escaneie de novo." };
  const enrolling = factor.status !== "verified";

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (challengeError || !challenge) return { error: "Não foi possível conferir o código agora. Tente de novo." };
  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code: parsed.data.code,
  });
  if (verifyError) {
    await recordAudit({ admin: ctx.admin, action: "auth.mfa_failed", target: { enrolling } });
    return { error: "Código incorreto ou vencido. Confira o aplicativo e tente de novo." };
  }

  await reset(limitKey);
  await sql()`update platform.admins set last_login_at = now(), updated_at = now() where id = ${ctx.admin.id}`;
  if (enrolling) await recordAudit({ admin: ctx.admin, action: "auth.mfa_enrolled" });
  await recordAudit({ admin: ctx.admin, action: "auth.login", target: { method: "password+totp" } });
  redirect(next);
}

/** Sair: encerra a sessao, apaga o cookie de tempo e deixa o registro. */
export async function signOutAction(): Promise<void> {
  const ctx = await getAdminContext();
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  (await cookies()).delete(SESSION_STARTED_COOKIE);
  if (ctx.stage === "ok" || ctx.stage === "needs_mfa") await recordAudit({ admin: ctx.admin, action: "auth.logout" });
  redirect("/login");
}
