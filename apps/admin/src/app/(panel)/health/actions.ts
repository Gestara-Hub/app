"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/context";
import { markKnown, unmarkKnown } from "@/lib/server/health";

/** "Erro conhecido" silencia o erro na lista do painel (o app dos clientes segue registrando). */
const fingerprint = z.string().min(8).max(200);

export async function markKnownAction(formData: FormData): Promise<void> {
  const { admin } = await requireAdmin("health:view");
  const parsed = fingerprint.safeParse(formData.get("fingerprint"));
  if (!parsed.success) return;
  await markKnown({ fingerprint: parsed.data, adminId: admin.id, adminName: admin.name });
  await recordAudit({ admin, action: "health.error_known", target: { fingerprint: parsed.data } });
  revalidatePath("/health", "layout");
}

export async function unmarkKnownAction(formData: FormData): Promise<void> {
  const { admin } = await requireAdmin("health:view");
  const parsed = fingerprint.safeParse(formData.get("fingerprint"));
  if (!parsed.success) return;
  await unmarkKnown(parsed.data);
  await recordAudit({ admin, action: "health.error_unknown", target: { fingerprint: parsed.data } });
  revalidatePath("/health", "layout");
}
