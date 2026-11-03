"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UpdateUser, UserProfile, UserView } from "@gestarahub/contracts";
import { guard } from "./userActionsShared";
import { resendInvitationAction } from "./inviteActions";
import { logError } from "@/lib/log";

/**
 * Usuarios do espaco no banco: listar, editar e inativar.
 */

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
      logError("[usersBackend] Erro ao listar usuários:", usersRes.error);
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
    logError("[usersBackend] Erro inesperado em listUsersFromDb:", err);
    return [];
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

    // 1. Confere estado atual do usuário (se tem auth_user_id, a conta já está confirmada/ativa)
    const { data: currentUser } = await admin
      .from("users")
      .select("email, auth_user_id")
      .eq("id", userId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!currentUser) {
      return { success: false, error: "Usuário não encontrado." };
    }

    const nextEmail = payload.email !== undefined ? payload.email.trim().toLowerCase() : undefined;
    const emailChanged = Boolean(nextEmail && nextEmail !== (currentUser.email as string).toLowerCase());

    if (emailChanged) {
      // Bloqueia alteração de e-mail quando a conta já foi ativada (padrão SaaS de segurança)
      if (currentUser.auth_user_id) {
        return {
          success: false,
          error: "O e-mail de acesso não pode ser alterado após a ativação da conta.",
        };
      }

      // Se ainda pendente de ativação, valida duplicidade na mesma organização
      const { data: duplicate } = await admin
        .from("users")
        .select("id")
        .eq("organization_id", organizationId)
        .ilike("email", nextEmail!)
        .neq("id", userId)
        .maybeSingle();

      if (duplicate) {
        return { success: false, error: "Já existe um usuário com este e-mail." };
      }
    }

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
      logError("[usersBackend] Erro ao atualizar usuário:", error);
      return { success: false, error: "Erro ao atualizar usuário no banco." };
    }

    // Se o e-mail mudou enquanto o convite estava pendente, envia convite para o novo endereço
    if (emailChanged) {
      await resendInvitationAction(organizationId, userId);
    }

    return { success: true };
  } catch (err) {
    logError("[usersBackend] Erro inesperado em updateUserInDb:", err);
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
      logError("[usersBackend] Erro ao inativar usuário:", error);
      return { success: false, error: "Não foi possível inativar o usuário." };
    }

    return { success: true };
  } catch (err) {
    logError("[usersBackend] Erro inesperado em inactivateUserInDb:", err);
    return { success: false, error: "Falha ao inativar usuário." };
  }
}
