"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendOrganizationInvitationEmail } from "@/lib/email/mailersend";
import { userProfileLabel } from "@/lib/labels";
import { can, canManageProfile } from "@/lib/permissions";
import { requireTenant } from "./server/tenant";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  encodeSession,
} from "@/lib/session";
import type {
  CreateUser,
  UpdateUser,
  UserProfile,
  UserView,
} from "@gestarahub/contracts";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Quem chama precisa estar logado no mesmo espaco (doc 15, fatia 3). Antes
 * estas actions usavam a chave de servico com o espaco vindo do navegador, sem
 * conferir sessao: qualquer um criava ou inativava usuario em qualquer espaco.
 * Gravar pede `users:manage` e so mexe nos perfis que o usuario administra
 * (dono: todos; gerente: atendente e profissional); a pessoa pode mudar o
 * proprio nome e e-mail.
 */
async function guard(
  organizationId: string,
  opts: { manage?: boolean; targetProfile?: UserProfile; targetUserId?: string } = {},
): Promise<string | null> {
  let ctx;
  try {
    ctx = await requireTenant();
  } catch {
    return "Sua sessão expirou. Entre de novo.";
  }
  if (ctx.organizationId !== organizationId) return "Você não tem permissão para esta ação.";
  if (!opts.manage) return null;
  if (opts.targetUserId && opts.targetUserId === ctx.userId && !opts.targetProfile) return null;
  if (!can(ctx.profile, "users:manage")) return "Você não tem permissão para esta ação.";
  if (opts.targetProfile && !canManageProfile(ctx.profile, opts.targetProfile)) {
    return "Você não tem permissão para gerenciar este perfil.";
  }
  if (opts.targetUserId) {
    const { data } = await createSupabaseAdminClient()
      .from("users")
      .select("profile")
      .eq("id", opts.targetUserId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (data && !canManageProfile(ctx.profile, data.profile as UserProfile) && opts.targetUserId !== ctx.userId) {
      return "Você não tem permissão para gerenciar este perfil.";
    }
  }
  return null;
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

async function resolveAppBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }
  const hdrs = await headers();
  const host =
    hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const proto =
    hdrs.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Lista todos os usuários de uma organização no Supabase com join de profissionais
 * e status de convites pendentes.
 */
export async function listUsersFromDb(
  organizationId: string,
): Promise<UserView[]> {
  if (await guard(organizationId)) return [];
  try {
    const admin = createSupabaseAdminClient();

    const [usersRes, professionalsRes, invitationsRes] = await Promise.all([
      admin
        .from("users")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true }),
      admin
        .from("professionals")
        .select("id, name, status")
        .eq("organization_id", organizationId),
      admin
        .from("organization_invitations")
        .select("user_id, status")
        .eq("organization_id", organizationId)
        .eq("status", "pending"),
    ]);

    if (usersRes.error) {
      console.error("[usersBackend] Erro ao listar usuários:", usersRes.error);
      return [];
    }

    const professionalsMap = new Map(
      (professionalsRes.data ?? []).map((p) => [p.id, p]),
    );

    const pendingUserIds = new Set(
      (invitationsRes.data ?? []).map((inv) => inv.user_id).filter(Boolean),
    );

    return (usersRes.data ?? []).map((row) => {
      const prof = row.professional_id
        ? professionalsMap.get(row.professional_id)
        : undefined;

      const isPending =
        pendingUserIds.has(row.id) || !row.auth_user_id;

      return {
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        email: row.email,
        profile: row.profile as UserProfile,
        professionalId: row.professional_id || undefined,
        professional: prof
          ? { id: prof.id, name: prof.name, status: prof.status }
          : undefined,
        status: row.status,
        pendingInvite: isPending && row.status === "active",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  } catch (err) {
    console.error("[usersBackend] Erro inesperado em listUsersFromDb:", err);
    return [];
  }
}

/**
 * Cria um usuário no Supabase e opcionalmente gera o token e envia o e-mail de convite.
 */
export async function createUserAndInviteAction(
  organizationId: string,
  payload: CreateUser,
  sendInvite = true,
): Promise<{ success: boolean; user?: UserView; error?: string }> {
  const denied = await guard(organizationId, { manage: true, targetProfile: payload.profile });
  if (denied) return { success: false, error: denied };
  try {
    const admin = createSupabaseAdminClient();
    const normalizedEmail = payload.email.trim().toLowerCase();

    // 1. Verifica se já existe usuário com este e-mail nesta organização
    const { data: existing } = await admin
      .from("users")
      .select("id")
      .eq("organization_id", organizationId)
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: "Já existe um usuário com este e-mail.",
      };
    }

    // 2. Busca dados da organização para o e-mail
    const { data: orgData } = await admin
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .single();

    const organizationName = orgData?.name || "Sua Organização";
    const userId = randomUUID();

    // 3. Insere o usuário em public.users
    const { data: insertedUser, error: insertUserErr } = await admin
      .from("users")
      .insert({
        id: userId,
        organization_id: organizationId,
        name: payload.name.trim(),
        email: normalizedEmail,
        profile: payload.profile,
        professional_id: payload.professionalId || null,
        status: payload.status || "active",
      })
      .select()
      .single();

    if (insertUserErr || !insertedUser) {
      console.error("[usersBackend] Erro ao inserir usuário:", insertUserErr);
      return {
        success: false,
        error: "Não foi possível criar o usuário no banco de dados.",
      };
    }

    let hasPendingInvite = false;

    // 4. Se solicitado, gera convite e envia e-mail
    if (sendInvite) {
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();

      await admin.from("organization_invitations").insert({
        organization_id: organizationId,
        user_id: userId,
        email: normalizedEmail,
        name: payload.name.trim(),
        profile: payload.profile,
        professional_id: payload.professionalId || null,
        token_hash: tokenHash,
        status: "pending",
        expires_at: expiresAt,
      });

      const baseUrl = await resolveAppBaseUrl();
      const inviteUrl = `${baseUrl}/accept-invite?token=${rawToken}`;

      await sendOrganizationInvitationEmail({
        toEmail: normalizedEmail,
        toName: payload.name.trim(),
        organizationName,
        profileLabel: userProfileLabel(payload.profile),
        inviteUrl,
        expiresInDays: 7,
      });

      hasPendingInvite = true;
    }

    // Busca profissional se houver
    let profView: { id: string; name: string; status: "active" | "inactive" } | undefined;
    if (payload.professionalId) {
      const { data: profData } = await admin
        .from("professionals")
        .select("id, name, status")
        .eq("id", payload.professionalId)
        .maybeSingle();
      if (profData) {
        profView = { id: profData.id, name: profData.name, status: profData.status };
      }
    }

    const userView: UserView = {
      id: insertedUser.id,
      organizationId: insertedUser.organization_id,
      name: insertedUser.name,
      email: insertedUser.email,
      profile: insertedUser.profile as UserProfile,
      professionalId: insertedUser.professional_id || undefined,
      professional: profView,
      status: insertedUser.status,
      pendingInvite: hasPendingInvite,
      createdAt: insertedUser.created_at,
      updatedAt: insertedUser.updated_at,
    };

    return { success: true, user: userView };
  } catch (err) {
    console.error("[usersBackend] Erro inesperado em createUserAndInviteAction:", err);
    return {
      success: false,
      error: "Ocorreu um erro ao cadastrar e convidar o usuário.",
    };
  }
}

/**
 * Atualiza os dados de um usuário no Supabase.
 */
export async function updateUserInDb(
  organizationId: string,
  userId: string,
  payload: UpdateUser,
): Promise<{ success: boolean; error?: string }> {
  const denied = await guard(organizationId, {
    manage: true,
    targetUserId: userId,
    targetProfile: payload.profile !== undefined || payload.status !== undefined || payload.professionalId !== undefined
      ? (payload.profile ?? undefined)
      : undefined,
  });
  if (denied) return { success: false, error: denied };
  // Mudar perfil, status ou vinculo de alguem pede `users:manage`, mesmo de si.
  if (
    (payload.status !== undefined || payload.professionalId !== undefined || payload.profile !== undefined) &&
    (await guard(organizationId, { manage: true, targetUserId: userId, targetProfile: payload.profile ?? "attendant" }))
  ) {
    return { success: false, error: "Você não tem permissão para esta ação." };
  }
  try {
    const admin = createSupabaseAdminClient();
    const updatePayload: Record<string, unknown> = {};

    if (payload.name !== undefined) updatePayload.name = payload.name.trim();
    if (payload.email !== undefined) updatePayload.email = payload.email.trim().toLowerCase();
    if (payload.profile !== undefined) updatePayload.profile = payload.profile;
    if (payload.professionalId !== undefined) {
      updatePayload.professional_id = payload.professionalId || null;
    }
    if (payload.status !== undefined) updatePayload.status = payload.status;

    const { error } = await admin
      .from("users")
      .update(updatePayload)
      .eq("id", userId)
      .eq("organization_id", organizationId);

    if (error) {
      console.error("[usersBackend] Erro ao atualizar usuário:", error);
      return { success: false, error: "Erro ao atualizar usuário no banco." };
    }

    return { success: true };
  } catch (err) {
    console.error("[usersBackend] Erro inesperado em updateUserInDb:", err);
    return { success: false, error: "Falha na comunicação com o banco." };
  }
}

/**
 * Inativa um usuário e revoga convites pendentes.
 */
export async function inactivateUserInDb(
  organizationId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const denied = await guard(organizationId, { manage: true, targetUserId: userId, targetProfile: "attendant" });
  if (denied) return { success: false, error: denied };
  try {
    const admin = createSupabaseAdminClient();

    await admin
      .from("organization_invitations")
      .update({ status: "revoked" })
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("status", "pending");

    const { error } = await admin
      .from("users")
      .update({ status: "inactive" })
      .eq("id", userId)
      .eq("organization_id", organizationId);

    if (error) {
      console.error("[usersBackend] Erro ao inativar usuário:", error);
      return { success: false, error: "Não foi possível inativar o usuário." };
    }

    return { success: true };
  } catch (err) {
    console.error("[usersBackend] Erro inesperado em inactivateUserInDb:", err);
    return { success: false, error: "Falha ao inativar usuário." };
  }
}

/**
 * Reenvia o e-mail de convite para um usuário com convite pendente.
 */
export async function resendInvitationAction(
  organizationId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const denied = await guard(organizationId, { manage: true, targetUserId: userId, targetProfile: "attendant" });
  if (denied) return { success: false, error: denied };
  try {
    const admin = createSupabaseAdminClient();

    const [userRes, orgRes] = await Promise.all([
      admin
        .from("users")
        .select("*")
        .eq("id", userId)
        .eq("organization_id", organizationId)
        .single(),
      admin
        .from("organizations")
        .select("name")
        .eq("id", organizationId)
        .single(),
    ]);

    if (!userRes.data) {
      return { success: false, error: "Usuário não encontrado." };
    }

    const user = userRes.data;
    const organizationName = orgRes.data?.name || "Sua Organização";

    // Revoga convites anteriores pendentes
    await admin
      .from("organization_invitations")
      .update({ status: "revoked" })
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("status", "pending");

    // Gera novo token de 7 dias
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();

    await admin.from("organization_invitations").insert({
      organization_id: organizationId,
      user_id: userId,
      email: user.email,
      name: user.name,
      profile: user.profile,
      professional_id: user.professional_id || null,
      token_hash: tokenHash,
      status: "pending",
      expires_at: expiresAt,
    });

    const baseUrl = await resolveAppBaseUrl();
    const inviteUrl = `${baseUrl}/accept-invite?token=${rawToken}`;

    const emailRes = await sendOrganizationInvitationEmail({
      toEmail: user.email,
      toName: user.name,
      organizationName,
      profileLabel: userProfileLabel(user.profile as UserProfile),
      inviteUrl,
      expiresInDays: 7,
    });

    if (!emailRes.ok) {
      return { success: false, error: emailRes.error };
    }

    return { success: true };
  } catch (err) {
    console.error("[usersBackend] Erro ao reenviar convite:", err);
    return { success: false, error: "Não foi possível reenviar o convite." };
  }
}

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
    console.error("[usersBackend] Erro ao validar token de convite:", err);
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
        console.error("[usersBackend] Erro ao criar conta de autenticação:", createAuthErr);
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
      console.warn("[usersBackend] Aviso no signInWithPassword após aceite:", signInErr);
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
    cookieStore.set(SESSION_COOKIE, encodeSession(sessionUser), {
      path: "/",
      maxAge: SESSION_MAX_AGE,
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return { ok: true };
  } catch (err) {
    console.error("[usersBackend] Erro ao aceitar convite:", err);
    return { ok: false, message: "Erro inesperado ao aceitar convite." };
  }
}
