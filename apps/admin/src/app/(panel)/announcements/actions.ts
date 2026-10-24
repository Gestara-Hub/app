"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/context";
import {
  audienceCount,
  createAnnouncement,
  getAnnouncement,
  setArchived,
  updateAnnouncement,
  type AnnouncementInput,
} from "@/lib/server/announcements";

export interface AnnouncementFormState {
  error?: string;
  preview?: string;
}

const TIERS = ["free", "pro", "scale"] as const;
const AREAS = [
  "martial_arts",
  "pilates_yoga",
  "functional_training",
  "dance",
  "music",
  "languages",
  "swimming_sports",
  "gastronomy",
  "arts_crafts",
  "beauty_courses",
  "custom",
] as const;

const schema = z.object({
  title: z.string().trim().min(3, "O título precisa de ao menos 3 letras.").max(120, "Use no máximo 120 caracteres no título."),
  body: z.string().trim().min(3, "Escreva a mensagem.").max(1000, "Use no máximo 1000 caracteres na mensagem."),
  severity: z.enum(["info", "warning", "urgent"]),
  audience: z.enum(["all", "tier", "area", "spaces"]),
  tiers: z.array(z.enum(TIERS)),
  areas: z.array(z.enum(AREAS)),
  spaces: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
});

const uuid = z.string().uuid();

/** Data e hora do formulario (horario de Brasilia, sem fuso) para um instante. */
function brasilia(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}:00-03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parse(formData: FormData): { input: AnnouncementInput } | { error: string } {
  const parsed = schema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    severity: formData.get("severity"),
    audience: formData.get("audience"),
    tiers: formData.getAll("tiers"),
    areas: formData.getAll("areas"),
    spaces: String(formData.get("spaces") ?? ""),
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os campos." };
  const v = parsed.data;
  const spaces = v.spaces
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (spaces.some((s) => !uuid.safeParse(s).success)) return { error: "Informe os espaços pelo código (um por linha)." };
  if (v.audience === "tier" && v.tiers.length === 0) return { error: "Escolha ao menos um plano." };
  if (v.audience === "area" && v.areas.length === 0) return { error: "Escolha ao menos uma área." };
  if (v.audience === "spaces" && spaces.length === 0) return { error: "Informe ao menos um espaço." };
  const startsAt = brasilia(v.startsAt);
  const endsAt = brasilia(v.endsAt);
  if (endsAt && endsAt <= (startsAt ?? new Date())) return { error: "O fim precisa ser depois do início." };
  const filter = v.audience === "tier" ? { tiers: v.tiers } : v.audience === "area" ? { areas: v.areas } : v.audience === "spaces" ? { spaces } : {};
  return { input: { title: v.title, body: v.body, severity: v.severity, audience: v.audience, filter, startsAt, endsAt } };
}

/** Quantos espacos recebem: a previa antes de publicar. */
export async function previewAudienceAction(_prev: AnnouncementFormState, formData: FormData): Promise<AnnouncementFormState> {
  await requireAdmin("announcements:manage");
  const result = parse(formData);
  if ("error" in result) return { error: result.error };
  const count = await audienceCount(result.input.audience, result.input.filter);
  return { preview: count === 1 ? "1 espaço receberá este comunicado." : `${count} espaços receberão este comunicado.` };
}

export async function saveAnnouncementAction(_prev: AnnouncementFormState, formData: FormData): Promise<AnnouncementFormState> {
  const { admin } = await requireAdmin("announcements:manage");
  const result = parse(formData);
  if ("error" in result) return { error: result.error };
  const rawId = formData.get("id");
  if (rawId) {
    const id = uuid.safeParse(rawId);
    if (!id.success || !(await getAnnouncement(id.data))) return { error: "Comunicado não encontrado." };
    await updateAnnouncement(id.data, result.input);
    await recordAudit({ admin, action: "announcement.update", target: { announcementId: id.data, title: result.input.title } });
  } else {
    const id = await createAnnouncement(result.input, admin);
    await recordAudit({
      admin,
      action: "announcement.create",
      target: { announcementId: id, title: result.input.title, severity: result.input.severity, audience: result.input.audience },
    });
  }
  revalidatePath("/announcements");
  redirect("/announcements");
}

export async function archiveAnnouncementAction(formData: FormData): Promise<void> {
  const { admin } = await requireAdmin("announcements:manage");
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return;
  const row = await getAnnouncement(id.data);
  if (!row) return;
  const archive = formData.get("archive") === "1";
  await setArchived(row.id, archive);
  await recordAudit({ admin, action: archive ? "announcement.archive" : "announcement.restore", target: { announcementId: row.id, title: row.title } });
  revalidatePath("/announcements");
}
