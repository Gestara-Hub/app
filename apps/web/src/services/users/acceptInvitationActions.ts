"use server";

import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SESSION_COOKIE } from "@/lib/session";
import { encodeSession, sessionCookieOptions } from "@/lib/session-cookie";
import type { UserProfile, UserView } from "@gestarahub/contracts";
import { PASSWORD_TOO_SHORT_MESSAGE, isPasswordLongEnough } from "@/lib/password-rules";
import { hashToken } from "./userActionsShared";
import { logError, logWarn } from "@/lib/log";

/**
 * Aceite do convite: validar o link e criar o acesso.
 */

/**
 * Validação de token de convite na rota pública `/accept-invite?token=...`.
 */
export async function validateInvitationTokenAction(
  rawToken: string | undefined,
): Promise<
  | {
      status: "valid";
      token: string;
      email: string;
      name: string;
      organizationName: string;
      profile: UserProfile;
    }
  | { status: "expired"; email: string; name: string }
  | { status: "accepted"; email: string }
  | { status: "invalid" }
> {
  const cleaned = rawToken?.trim();
  if (!cleaned) return { status: "invalid" };

  try {
    const admin = createSupabaseAdminClient();
    const tokenHash = hashToken(cleaned);

    const { data: inv, error } = await admin
      .from("organization_invitations")
      .select("*, organizations(name)")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error || !inv) {
      return { status: "invalid" };
    }

    if (inv.status === "accepted") {
      return { status: "accepted", email: inv.email };
    }

    const isPast = new Date(inv.expires_at) <= new Date();
    if (inv.status === "expired" || inv.status === "revoked" || isPast) {
      return { status: "expired", email: inv.email, name: inv.name };
    }

    // Cast da organization
    const org = Array.isArray(inv.organizations)
      ? inv.organizations[0]
      : inv.organizations;
    const organizationName = org?.name || "GestaraHub";

    return {
      status: "valid",
      token: cleaned,
      email: inv.email,
      name: inv.name,
      organizationName,
      profile: inv.profile as UserProfile,
    };
  } catch (err) {
    logError("[usersBackend] Erro ao validar token de convite:", err);
    return { status: "invalid" };
  }
}

/**
 * Aceite do convite e definição de senha.
 */
export async function acceptInvitationAction(input: {
  token: string;
  password: string;
}): Promise<{ ok: boolean; message?: string }> {
  // Mesma regra das outras telas de senha (o formulario confere, o servidor tambem).
  if (!isPasswordLongEnough(input.password)) return { ok: false, message: PASSWORD_TOO_SHORT_MESSAGE };
  try {
    const admin = createSupabaseAdminClient();
    const tokenHash = hashToken(input.token.trim());

    // 1. Busca convite
    const { data: inv, error: invErr } = await admin
      .from("organization_invitations")
      .select("*")
      .eq("token_hash", tokenHash)
      .eq("status", "pending")
      .maybeSingle();

    if (invErr || !inv) {
      return { ok: false, message: "Convite inválido ou expirado." };
    }

    if (new Date(inv.expires_at) <= new Date()) {
      return { ok: false, message: "Este convite expirou. Peça ao administrador para reenviar." };
    }

    const normalizedEmail = inv.email.trim().toLowerCase();

    // 2. Cria ou atualiza usuário no Supabase Auth
    let authUserId: string;

    const { data: createdAuth, error: createAuthErr } =
      await admin.auth.admin.createUser({
        email: normalizedEmail,
        password: input.password,
        email_confirm: true,
        user_metadata: { name: inv.name },
      });

    if (createdAuth?.user) {
      authUserId = createdAuth.user.id;
    } else {
      // Se já existe no Auth (ex: convidado para outra org antes), atualiza senha
      const { data: existingUsers } = await admin.auth.admin.listUsers();
      const match = (existingUsers?.users ?? []).find(
        (u) => u.email?.toLowerCase() === normalizedEmail,
      );
      if (!match) {
        logError("[usersBackend] Erro ao criar conta de autenticação:", createAuthErr);
        return {
          ok: false,
          message: "Não foi possível configurar seu acesso. Tente novamente.",
        };
      }
      authUserId = match.id;
      await admin.auth.admin.updateUserById(authUserId, {
        password: input.password,
        email_confirm: true,
        user_metadata: { name: inv.name },
      });
    }

    // 3. Vincula auth_user_id em public.users
    await admin
      .from("users")
      .update({
        auth_user_id: authUserId,
        status: "active",
      })
      .eq("id", inv.user_id);

    // 4. Marca convite como aceito
    await admin
      .from("organization_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", inv.id);

    // 5. Inicia sessão do usuário logando com a nova senha
    const supabaseServer = await createSupabaseServerClient();
    const { error: signInErr } = await supabaseServer.auth.signInWithPassword({
      email: normalizedEmail,
      password: input.password,
    });

    if (signInErr) {
      logWarn("[usersBackend] Aviso no signInWithPassword após aceite:", signInErr);
    }

    // Seta também o cookie de sessão do GestaraHub
    const sessionUser: UserView = {
      id: inv.user_id,
      organizationId: inv.organization_id,
      name: inv.name,
      email: normalizedEmail,
      profile: inv.profile as UserProfile,
      professionalId: inv.professional_id || undefined,
      status: "active",
      createdAt: inv.created_at,
      updatedAt: new Date().toISOString(),
    };

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, encodeSession(sessionUser), sessionCookieOptions());

    return { ok: true };
  } catch (err) {
    logError("[usersBackend] Erro ao aceitar convite:", err);
    return { ok: false, message: "Erro inesperado ao aceitar convite." };
  }
}
