"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/context";
import { SupportAccessError, endAccess, startAccess } from "@/lib/server/support-access";
import { getSpace } from "@/lib/server/spaces";

export interface AccessFormState {
  error?: string;
}

const schema = z.object({
  spaceId: z.string().min(1),
  reason: z.string().trim().min(5, "Diga o motivo (pelo menos 5 letras).").max(300, "Motivo de até 300 caracteres."),
});

/** Abre a visão de suporte (somente leitura, 30 minutos) e leva para ela. */
export async function startAccessAction(_prev: AccessFormState, formData: FormData): Promise<AccessFormState> {
  const { admin } = await requireAdmin("support:access");
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os campos." };
  if (!(await getSpace(parsed.data.spaceId))) return { error: "Espaço não encontrado." };
  let sessionId: string;
  try {
    sessionId = await startAccess({ organizationId: parsed.data.spaceId, reason: parsed.data.reason, admin: { id: admin.id, name: admin.name } });
  } catch (error) {
    if (error instanceof SupportAccessError) return { error: error.message };
    throw error;
  }
  redirect(`/support-view/${sessionId}`);
}

export async function endAccessAction(formData: FormData): Promise<void> {
  const { admin } = await requireAdmin("support:access");
  const parsed = z.object({ sessionId: z.string().uuid(), spaceId: z.string().min(1) }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/spaces");
  await endAccess(parsed.data.sessionId, { id: admin.id, name: admin.name });
  redirect(`/spaces/${parsed.data.spaceId}?tab=suporte`);
}
