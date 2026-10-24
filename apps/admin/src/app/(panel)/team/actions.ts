"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ADMIN_ROLES } from "@/lib/permissions";
import { AuthAdminUnavailable } from "@/lib/server/auth-admin";
import { recordAudit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/context";
import { TeamError, changeRole, inviteAdmin, resendInvite, resetMfa, setActive } from "@/lib/server/team";

export interface TeamFormState {
  ok?: boolean;
  error?: string;
  message?: string;
  /** Sem e-mail configurado: o link para repassar (aparece uma vez, nao e gravado). */
  link?: string;
}

const id = z.string().uuid();

function fail(error: unknown): TeamFormState {
  if (error instanceof TeamError || error instanceof AuthAdminUnavailable) return { error: error.message };
  throw error;
}

export async function inviteAction(_prev: TeamFormState, formData: FormData): Promise<TeamFormState> {
  const { admin } = await requireAdmin("team:manage");
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Informe o nome.").max(80),
      email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
      role: z.enum(ADMIN_ROLES),
    })
    .safeParse({ name: formData.get("name"), email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os campos." };
  try {
    const result = await inviteAdmin({ ...parsed.data, inviter: admin });
    await recordAudit({ admin, action: "admin.invited", target: { adminId: result.id, email: parsed.data.email, role: parsed.data.role, emailed: result.emailed } });
    revalidatePath("/team");
    return result.emailed
      ? { ok: true, message: `Convite enviado para ${parsed.data.email}.` }
      : { ok: true, message: "Convite criado, mas o e-mail não está configurado. Repasse o link abaixo (vale por pouco tempo).", link: result.link };
  } catch (error) {
    return fail(error);
  }
}

export async function resendInviteAction(_prev: TeamFormState, formData: FormData): Promise<TeamFormState> {
  const { admin } = await requireAdmin("team:manage");
  const target = id.safeParse(formData.get("id"));
  if (!target.success) return { error: "Administrador não encontrado." };
  try {
    const result = await resendInvite(target.data, admin.name);
    await recordAudit({ admin, action: "admin.invite_resent", target: { adminId: target.data, emailed: result.emailed } });
    return result.emailed
      ? { ok: true, message: "Convite reenviado." }
      : { ok: true, message: "E-mail não configurado. Repasse o link abaixo.", link: result.link };
  } catch (error) {
    return fail(error);
  }
}

export async function changeRoleAction(_prev: TeamFormState, formData: FormData): Promise<TeamFormState> {
  const { admin } = await requireAdmin("team:manage");
  const parsed = z.object({ id, role: z.enum(ADMIN_ROLES) }).safeParse({ id: formData.get("id"), role: formData.get("role") });
  if (!parsed.success) return { error: "Escolha um papel." };
  try {
    const { before } = await changeRole(parsed.data.id, parsed.data.role, admin.id);
    await recordAudit({ admin, action: "admin.role_changed", target: { adminId: parsed.data.id }, before: { role: before }, after: { role: parsed.data.role } });
    revalidatePath("/team");
    return { ok: true, message: "Papel atualizado." };
  } catch (error) {
    return fail(error);
  }
}

export async function setActiveAction(_prev: TeamFormState, formData: FormData): Promise<TeamFormState> {
  const { admin } = await requireAdmin("team:manage");
  const parsed = z.object({ id, active: z.enum(["1", "0"]) }).safeParse({ id: formData.get("id"), active: formData.get("active") });
  if (!parsed.success) return { error: "Pedido inválido." };
  try {
    const row = await setActive(parsed.data.id, parsed.data.active === "1", admin.id);
    await recordAudit({ admin, action: parsed.data.active === "1" ? "admin.enabled" : "admin.disabled", target: { adminId: row.id, email: row.email } });
    revalidatePath("/team");
    return { ok: true, message: parsed.data.active === "1" ? "Acesso reativado." : "Acesso desativado." };
  } catch (error) {
    return fail(error);
  }
}

export async function resetMfaAction(_prev: TeamFormState, formData: FormData): Promise<TeamFormState> {
  const { admin } = await requireAdmin("team:manage");
  const target = id.safeParse(formData.get("id"));
  if (!target.success) return { error: "Administrador não encontrado." };
  try {
    const { row, removed } = await resetMfa(target.data, admin.id);
    await recordAudit({ admin, action: "admin.mfa_reset", target: { adminId: row.id, email: row.email, removed } });
    return { ok: true, message: "Segundo fator reiniciado. No próximo acesso a pessoa configura o aplicativo de novo." };
  } catch (error) {
    return fail(error);
  }
}
