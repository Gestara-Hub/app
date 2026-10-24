"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/context";
import { PlanActionError, extendGrace, forceFree, grantCourtesy, revokeCourtesy } from "@/lib/server/plans";
import { getSpace } from "@/lib/server/spaces";

export interface PlanFormState {
  ok?: boolean;
  message?: string;
  error?: string;
}

const reason = z.string().trim().min(5, "Diga o motivo (pelo menos 5 letras).").max(300, "Motivo de até 300 caracteres.");
const base = { spaceId: z.string().min(1) };

async function run<S extends z.ZodType<{ spaceId: string }>>(
  formData: FormData,
  schema: S,
  execute: (input: z.infer<S>, admin: { id: string; name: string }) => Promise<string>,
): Promise<PlanFormState> {
  const { admin } = await requireAdmin("plans:grant");
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os campos." };
  const spaceId = parsed.data.spaceId;
  if (!(await getSpace(spaceId))) return { error: "Espaço não encontrado." };
  try {
    const message = await execute(parsed.data, { id: admin.id, name: admin.name });
    revalidatePath(`/spaces/${spaceId}`);
    revalidatePath("/plans");
    return { ok: true, message };
  } catch (error) {
    if (error instanceof PlanActionError) return { error: error.message };
    throw error;
  }
}

const br = (day: string) => day.split("-").reverse().join("/");

export async function grantCourtesyAction(_prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const schema = z.object({
    ...base,
    tier: z.enum(["pro", "scale"], { error: "Escolha o plano." }),
    days: z.coerce.number({ error: "Informe os dias." }).int("Informe os dias.").min(1, "De 1 a 365 dias.").max(365, "De 1 a 365 dias."),
    reason,
  });
  return run(formData, schema, async (input, admin) => {
    const ends = await grantCourtesy({ organizationId: input.spaceId, tier: input.tier, days: input.days, reason: input.reason, admin });
    return `Cortesia concedida até ${br(ends)}.`;
  });
}

export async function revokeCourtesyAction(_prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const schema = z.object({ ...base, reason });
  return run(formData, schema, async (input, admin) => {
    await revokeCourtesy({ organizationId: input.spaceId, reason: input.reason, admin });
    return "Cortesia encerrada. O espaço voltou ao Grátis.";
  });
}

export async function extendGraceAction(_prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const schema = z.object({
    ...base,
    days: z.coerce.number({ error: "Informe os dias." }).int("Informe os dias.").min(1, "De 1 a 30 dias.").max(30, "De 1 a 30 dias."),
    reason,
  });
  return run(formData, schema, async (input, admin) => {
    const renews = await extendGrace({ organizationId: input.spaceId, days: input.days, reason: input.reason, admin });
    return `Nova data da renovação: ${br(renews)}.`;
  });
}

export async function forceFreeAction(_prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const schema = z.object({ ...base, partnerCanceled: z.string().optional(), reason });
  return run(formData, schema, async (input, admin) => {
    await forceFree({ organizationId: input.spaceId, partnerCanceled: input.partnerCanceled === "1", reason: input.reason, admin });
    return "O espaço voltou ao Grátis.";
  });
}
