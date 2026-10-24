"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/context";
import { AuthAdminUnavailable } from "@/lib/server/auth-admin";
import { PrivacyError, setSpaceStatus } from "@/lib/server/privacy";
import { UserTwoFactorError, resetUserTwoFactor } from "@/lib/server/user-two-factor";
import { getSpace } from "@/lib/server/spaces";
import type { PlanFormState } from "./plan-actions";

const schema = z.object({
  spaceId: z.string().min(1),
  reason: z.string().trim().min(5, "Diga o motivo (pelo menos 5 letras).").max(300, "Motivo de até 300 caracteres."),
});

async function change(formData: FormData, status: "active" | "inactive"): Promise<PlanFormState> {
  const { admin } = await requireAdmin("lgpd:manage");
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os campos." };
  if (!(await getSpace(parsed.data.spaceId))) return { error: "Espaço não encontrado." };
  try {
    await setSpaceStatus({ organizationId: parsed.data.spaceId, status, reason: parsed.data.reason, admin: { id: admin.id, name: admin.name } });
  } catch (error) {
    if (error instanceof PrivacyError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/spaces/${parsed.data.spaceId}`);
  revalidatePath("/spaces");
  return { ok: true, message: status === "inactive" ? "Espaço inativado. Ninguém dele entra até reativar." : "Espaço reativado." };
}

export async function inactivateSpaceAction(_prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  return change(formData, "inactive");
}

export async function reactivateSpaceAction(_prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  return change(formData, "active");
}

const userSchema = schema.extend({ userId: z.string().min(1, "Escolha a pessoa.") });

/** Reinicia o 2FA de uma pessoa do espaco (perdeu o aplicativo e os codigos de recuperacao). So o proprietario. */
export async function resetUserTwoFactorAction(_prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const { admin } = await requireAdmin("lgpd:manage");
  const parsed = userSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os campos." };
  if (!(await getSpace(parsed.data.spaceId))) return { error: "Espaço não encontrado." };
  try {
    const { name, emailed } = await resetUserTwoFactor({ organizationId: parsed.data.spaceId, userId: parsed.data.userId, reason: parsed.data.reason, admin: { id: admin.id, name: admin.name } });
    revalidatePath(`/spaces/${parsed.data.spaceId}`);
    return { ok: true, message: `Verificação de ${name} reiniciada.${emailed ? " Avisamos a pessoa por e-mail." : " O e-mail de aviso não saiu (sem envio configurado); avise a pessoa."}` };
  } catch (error) {
    if (error instanceof UserTwoFactorError || error instanceof AuthAdminUnavailable) return { error: error.message };
    throw error;
  }
}
