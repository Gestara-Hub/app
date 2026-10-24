import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { can, isAdminRole, type AdminPermission, type AdminRole } from "../permissions";
import { SESSION_STARTED_COOKIE, verifySessionStart } from "../session-token";
import { sql } from "./db";
import { getEnv } from "./env";
import { createAuthClient } from "./supabase";

export interface AdminRow {
  id: string;
  authUserId: string;
  name: string;
  email: string;
  role: AdminRole;
  lastLoginAt: Date | null;
}

export type AdminContext =
  | { stage: "anonymous"; hasSession: boolean; reason?: "expired" | "invalid" | "not_admin" }
  | { stage: "needs_mfa"; user: User; admin: AdminRow; startedAtMs: number }
  | { stage: "ok"; user: User; admin: AdminRow; startedAtMs: number };

/**
 * Quem esta no painel agora. So vale para quem passou por TUDO: sessao do
 * Supabase, marcador de plataforma, linha ativa em `platform.admins`, tempo de
 * sessao e segundo fator (AAL2). Uma leitura por requisicao.
 */
export const getAdminContext = cache(async (): Promise<AdminContext> => {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { stage: "anonymous", hasSession: false };

  // Usuario de espaco (ou qualquer conta sem o marcador) nunca entra aqui.
  if (user.app_metadata?.platform !== true) return { stage: "anonymous", hasSession: true, reason: "not_admin" };

  const rows = await sql()<
    { id: string; auth_user_id: string; name: string; email: string; role: string; last_login_at: Date | null }[]
  >`select id, auth_user_id, name, email, role, last_login_at from platform.admins where auth_user_id = ${user.id} and status = 'active'`;
  const row = rows[0];
  if (!row || !isAdminRole(row.role)) return { stage: "anonymous", hasSession: true, reason: "not_admin" };
  const admin: AdminRow = {
    id: row.id,
    authUserId: row.auth_user_id,
    name: row.name,
    email: row.email,
    role: row.role,
    lastLoginAt: row.last_login_at,
  };

  const started = verifySessionStart(
    getEnv().ADMIN_SESSION_SECRET,
    user.id,
    (await cookies()).get(SESSION_STARTED_COOKIE)?.value,
    Date.now(),
  );
  if (!started.ok) {
    return { stage: "anonymous", hasSession: true, reason: started.reason === "expired" ? "expired" : "invalid" };
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const stage = aal?.currentLevel === "aal2" ? "ok" : "needs_mfa";
  return { stage, user, admin, startedAtMs: started.startedAtMs };
});

/** Guarda das paginas do painel: manda para o passo que falta ou devolve o contexto completo. */
export async function requireAdmin(permission?: AdminPermission): Promise<Extract<AdminContext, { stage: "ok" }>> {
  const ctx = await getAdminContext();
  if (ctx.stage === "anonymous") {
    redirect(ctx.hasSession ? `/session/end?reason=${ctx.reason ?? "invalid"}` : "/login");
  }
  if (ctx.stage === "needs_mfa") redirect("/mfa");
  if (permission && !can(ctx.admin.role, permission)) redirect("/?denied=1");
  return ctx;
}

/** Para as telas de login e segundo fator: quem ja esta completo vai para o painel. */
export async function redirectIfSignedIn(): Promise<void> {
  const ctx = await getAdminContext();
  if (ctx.stage === "ok") redirect("/");
}
