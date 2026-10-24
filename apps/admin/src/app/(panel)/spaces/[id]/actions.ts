"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/context";
import { addSpaceNote, deleteSpaceNote, getSpace, setSpaceNotePinned } from "@/lib/server/spaces";

export interface SpaceFormState {
  ok?: boolean;
  error?: string;
}

const body = z.string().trim().min(1, "Escreva a anotação.").max(2000, "Use no máximo 2000 caracteres.");

export async function addNoteAction(_prev: SpaceFormState, formData: FormData): Promise<SpaceFormState> {
  const { admin } = await requireAdmin("spaces:annotate");
  const parsed = z.object({ spaceId: z.string().min(1), body }).safeParse({ spaceId: formData.get("spaceId"), body: formData.get("body") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira a anotação." };
  const space = await getSpace(parsed.data.spaceId);
  if (!space) return { error: "Espaço não encontrado." };
  await addSpaceNote({ organizationId: space.id, adminId: admin.id, adminName: admin.name, body: parsed.data.body });
  await recordAudit({ admin, action: "space.note_add", organizationId: space.id });
  revalidatePath(`/spaces/${space.id}`);
  return { ok: true };
}

export async function pinNoteAction(formData: FormData): Promise<void> {
  const { admin } = await requireAdmin("spaces:annotate");
  const parsed = z.object({ id: z.string().uuid(), spaceId: z.string().min(1), pinned: z.enum(["0", "1"]) }).safeParse({
    id: formData.get("id"),
    spaceId: formData.get("spaceId"),
    pinned: formData.get("pinned"),
  });
  if (!parsed.success) return;
  await setSpaceNotePinned(parsed.data.id, parsed.data.pinned === "1");
  await recordAudit({ admin, action: "space.note_pin", organizationId: parsed.data.spaceId });
  revalidatePath(`/spaces/${parsed.data.spaceId}`);
}

export async function deleteNoteAction(formData: FormData): Promise<void> {
  const { admin } = await requireAdmin("spaces:annotate");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const removed = await deleteSpaceNote(id.data);
  if (!removed) return;
  await recordAudit({ admin, action: "space.note_delete", organizationId: removed.organizationId });
  revalidatePath(`/spaces/${removed.organizationId}`);
}
