"use server";

import { likeExact } from "@/lib/supabase/like";
import { randomBytes, randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendOrganizationInvitationEmail } from "@/lib/email/mailersend";
import { userProfileLabel } from "@/lib/labels";
import type { CreateUser, UserProfile, UserView } from "@gestarahub/contracts";
import { SEVEN_DAYS_MS, guard, hashToken, resolveAppBaseUrl } from "./userActionsShared";
import { logError } from "@/lib/log";

/**
 * Convite de usuario: criar com convite e reenviar.
 */

/**
 * Cria um usuário no Supabase e opcionalmente gera o token e envia o e-mail de convite.
 */
export async function createUserAndInviteAction(
  organizationId: string,
  payload: CreateUser,
  sendInvite = true,
): Promise<{
  success: boolean;
  user?: UserView;
  error?: string;
  /** Convite pedido e e-mail enviado. Falhou: `inviteError` diz o motivo e o usuario fica criado. */
  inviteSent?: boolean;
  inviteError?: string;
}> {
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
      .ilike("email", likeExact(normalizedEmail))
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
      logError("[usersBackend] Erro ao inserir usuário:", insertUserErr);
      return {
        success: false,
        error: "Não foi possível criar o usuário no banco de dados.",
      };
    }

    let hasPendingInvite = false;
    let inviteSent = false;
    let inviteError: string | undefined;

    // 4. Se solicitado, gera convite e envia e-mail
    if (sendInvite) {
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();

      const { error: inviteInsertErr } = await admin.from("organization_invitations").insert({
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

      if (inviteInsertErr) {
        logError("[usersBackend] Erro ao criar convite:", inviteInsertErr);
        inviteError = "Não foi possível gerar o convite.";
      } else {
        const baseUrl = await resolveAppBaseUrl();
        const inviteUrl = `${baseUrl}/accept-invite?token=${rawToken}`;

        const emailRes = await sendOrganizationInvitationEmail({
          toEmail: normalizedEmail,
          toName: payload.name.trim(),
          organizationName,
          profileLabel: userProfileLabel(payload.profile),
          inviteUrl,
          expiresInDays: 7,
        });

        if (emailRes.ok) {
          inviteSent = true;
        } else {
          // O e-mail nao saiu: o convite nao vale. O usuario fica criado e
          // "Reenviar convite" na lista tenta de novo.
          await admin.from("organization_invitations").update({ status: "revoked" }).eq("token_hash", tokenHash);
          inviteError = emailRes.error;
        }
      }
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

    return { success: true, user: userView, inviteSent, inviteError };
  } catch (err) {
    logError("[usersBackend] Erro inesperado em createUserAndInviteAction:", err);
    return {
      success: false,
      error: "Ocorreu um erro ao cadastrar e convidar o usuário.",
    };
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

    // Gera novo token de 7 dias
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();

    const { error: inviteInsertErr } = await admin.from("organization_invitations").insert({
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

    if (inviteInsertErr) {
      logError("[usersBackend] Erro ao criar convite:", inviteInsertErr);
      return { success: false, error: "Não foi possível gerar o convite." };
    }

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
      // O e-mail nao saiu: o convite novo nao vale e o anterior segue valendo.
      await admin.from("organization_invitations").update({ status: "revoked" }).eq("token_hash", tokenHash);
      return { success: false, error: emailRes.error };
    }

    // Enviado: so agora revoga os convites anteriores pendentes.
    await admin
      .from("organization_invitations")
      .update({ status: "revoked" })
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("status", "pending")
      .neq("token_hash", tokenHash);

    return { success: true };
  } catch (err) {
    logError("[usersBackend] Erro ao reenviar convite:", err);
    return { success: false, error: "Não foi possível reenviar o convite." };
  }
}
