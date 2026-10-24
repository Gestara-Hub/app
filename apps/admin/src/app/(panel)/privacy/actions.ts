"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/context";
import { REQUEST_KINDS, REQUEST_STATUS, PrivacyError, createRequest, updateRequest, type RequestKind, type RequestStatus } from "@/lib/server/privacy";
import { getSpace } from "@/lib/server/spaces";

export interface PrivacyFormState {
  ok?: boolean;
  error?: string;
  message?: string;
}

const kinds = Object.keys(REQUEST_KINDS) as [RequestKind, ...RequestKind[]];
const statuses = Object.keys(REQUEST_STATUS) as [RequestStatus, ...RequestStatus[]];

export async function createRequestAction(_prev: PrivacyFormState, formData: FormData): Promise<PrivacyFormState> {
  const { admin } = await requireAdmin("lgpd:manage");
  const parsed = z
    .object({
      requesterName: z.string().trim().min(2, "Informe o nome de quem pediu.").max(120),
      requesterEmail: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
      kind: z.enum(kinds),
      description: z.string().trim().min(3, "Descreva o pedido.").max(2000, "Use no máximo 2000 caracteres."),
      spaceId: z.string().trim().optional(),
    })
    .safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os campos." };
  const spaceId = parsed.data.spaceId || null;
  if (spaceId && !(await getSpace(spaceId))) return { error: "Espaço não encontrado. Confira o código." };
  const id = await createRequest({ ...parsed.data, organizationId: spaceId, adminName: admin.name });
  // Sem nome nem e-mail do titular na auditoria: so o tipo e o numero do pedido.
  await recordAudit({ admin, action: "privacy.create", organizationId: spaceId, target: { requestId: id, kind: parsed.data.kind } });
  revalidatePath("/privacy");
  return { ok: true, message: "Pedido registrado. O prazo de resposta é de 15 dias." };
}

export async function updateRequestAction(_prev: PrivacyFormState, formData: FormData): Promise<PrivacyFormState> {
  const { admin } = await requireAdmin("lgpd:manage");
  const parsed = z
    .object({ id: z.string().uuid(), status: z.enum(statuses), resolution: z.string().trim().max(2000).default("") })
    .safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Confira os campos." };
  try {
    const { before } = await updateRequest({ ...parsed.data, adminName: admin.name });
    await recordAudit({ admin, action: "privacy.update", target: { requestId: parsed.data.id }, before: { status: before }, after: { status: parsed.data.status } });
    revalidatePath("/privacy");
    return { ok: true, message: "Pedido atualizado." };
  } catch (error) {
    if (error instanceof PrivacyError) return { error: error.message };
    throw error;
  }
}
