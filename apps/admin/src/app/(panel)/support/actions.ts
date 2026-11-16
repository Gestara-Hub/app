"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/context";
import { renderSupportConversationEmail } from "@gestarahub/core/email-layouts";
import { formatProtocol } from "@gestarahub/core/support-protocol";
import { sendEmail } from "@/lib/server/email";
import { getEnv } from "@/lib/server/env";
import {
  addInternalNote,
  addStaffReply,
  deleteMacro,
  getThread,
  saveMacro,
  setBugStatus,
  setThreadStatus,
  setThreadUrgent,
} from "@/lib/server/support";
import { BUG_STATUSES, type BugStatus } from "@/lib/support-types";

export interface SupportFormState {
  ok?: boolean;
  error?: string;
}

const body = z.string().trim().min(1, "Escreva a mensagem.").max(4000, "Use no máximo 4000 caracteres.");
const id = z.string().uuid();

/** Resposta ao cliente: grava, passa a conversa para "aguardando o cliente" e avisa por e-mail. */
export async function replyAction(_prev: SupportFormState, formData: FormData): Promise<SupportFormState> {
  const { admin } = await requireAdmin("support:reply");
  const parsed = z.object({ threadId: id, body }).safeParse({ threadId: formData.get("threadId"), body: formData.get("body") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira a mensagem." };
  const thread = await getThread(parsed.data.threadId);
  if (!thread) return { error: "Conversa não encontrada." };

  await addStaffReply({ threadId: thread.id, adminId: admin.id, adminName: admin.name, body: parsed.data.body });
  const protocol = formatProtocol(thread.number);
  const firstName = thread.userName.split(" ")[0] || thread.userName;
  const appUrl = getEnv().WEB_APP_URL;
  const emailed = await sendEmail({
    to: { email: thread.userEmail, name: thread.userName },
    subject: `Resposta do suporte do GestaraHub [${protocol}]: ${thread.subject}`,
    html: (icon) =>
      renderSupportConversationEmail({
        firstName,
        protocol,
        threadSubject: thread.subject,
        replyBody: parsed.data.body,
        appUrl,
        icon,
      }),
    text: [
      `Olá, ${firstName}!`,
      "",
      `O suporte do GestaraHub respondeu à sua conversa (protocolo ${protocol}):`,
      "",
      parsed.data.body,
      "",
      `Para continuar, abra o GestaraHub (${appUrl}) e use "Fale com a gente" no menu do seu usuário.`,
    ].join("\n"),
  });
  await recordAudit({ admin, action: "support.reply", organizationId: thread.organizationId, target: { threadId: thread.id, emailed } });
  revalidatePath("/support");
  revalidatePath(`/support/${thread.id}`);
  return { ok: true };
}

export async function noteAction(_prev: SupportFormState, formData: FormData): Promise<SupportFormState> {
  const { admin } = await requireAdmin("support:reply");
  const parsed = z.object({ threadId: id, body }).safeParse({ threadId: formData.get("threadId"), body: formData.get("body") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira a nota." };
  const thread = await getThread(parsed.data.threadId);
  if (!thread) return { error: "Conversa não encontrada." };
  await addInternalNote({ threadId: thread.id, adminId: admin.id, adminName: admin.name, body: parsed.data.body });
  await recordAudit({ admin, action: "support.note", organizationId: thread.organizationId, target: { threadId: thread.id } });
  revalidatePath(`/support/${thread.id}`);
  return { ok: true };
}

async function changeStatus(formData: FormData, status: "resolved" | "waiting_us", action: string): Promise<void> {
  const { admin } = await requireAdmin("support:reply");
  const threadId = id.safeParse(formData.get("threadId"));
  if (!threadId.success) return;
  const thread = await getThread(threadId.data);
  if (!thread) return;
  await setThreadStatus(thread.id, status);
  await recordAudit({ admin, action, organizationId: thread.organizationId, target: { threadId: thread.id, from: thread.status } });
  revalidatePath("/support");
  revalidatePath(`/support/${thread.id}`);
}

export async function resolveAction(formData: FormData): Promise<void> {
  await changeStatus(formData, "resolved", "support.resolve");
}

export async function reopenAction(formData: FormData): Promise<void> {
  await changeStatus(formData, "waiting_us", "support.reopen");
}

export async function urgentAction(formData: FormData): Promise<void> {
  const { admin } = await requireAdmin("support:reply");
  const threadId = id.safeParse(formData.get("threadId"));
  if (!threadId.success) return;
  const thread = await getThread(threadId.data);
  if (!thread) return;
  const urgent = formData.get("urgent") === "1";
  await setThreadUrgent(thread.id, urgent);
  await recordAudit({ admin, action: urgent ? "support.mark_urgent" : "support.unmark_urgent", organizationId: thread.organizationId, target: { threadId: thread.id } });
  revalidatePath("/support");
  revalidatePath(`/support/${thread.id}`);
}

const macroSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2, "Dê um título.").max(80, "Título de até 80 caracteres."),
  body,
});

export async function saveMacroAction(_prev: SupportFormState, formData: FormData): Promise<SupportFormState> {
  const { admin } = await requireAdmin("support:reply");
  const parsed = macroSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os campos." };
  await saveMacro({ ...parsed.data, adminId: admin.id });
  await recordAudit({ admin, action: parsed.data.id ? "support.macro_update" : "support.macro_create", target: { title: parsed.data.title } });
  revalidatePath("/support/macros");
  return { ok: true };
}

export async function deleteMacroAction(formData: FormData): Promise<void> {
  const { admin } = await requireAdmin("support:reply");
  const macroId = id.safeParse(formData.get("id"));
  if (!macroId.success) return;
  await deleteMacro(macroId.data);
  await recordAudit({ admin, action: "support.macro_delete", target: { id: macroId.data } });
  revalidatePath("/support/macros");
}

/** Andamento do bug (novo, investigando, corrigido, não reproduzi) e, ao corrigir, em que versão. */
export async function bugStatusAction(formData: FormData): Promise<void> {
  const { admin } = await requireAdmin("support:reply");
  const parsed = z
    .object({ threadId: id, status: z.enum(BUG_STATUSES as [BugStatus, ...BugStatus[]]), fixedIn: z.string().trim().max(80).optional() })
    .safeParse({ threadId: formData.get("threadId"), status: formData.get("status"), fixedIn: formData.get("fixedIn") ?? undefined });
  if (!parsed.success) return;
  const thread = await getThread(parsed.data.threadId);
  if (!thread || thread.kind !== "bug") return;
  const changed = await setBugStatus({ threadId: thread.id, status: parsed.data.status, fixedIn: parsed.data.fixedIn });
  if (!changed) return;
  await recordAudit({
    admin,
    action: "support.bug_status",
    organizationId: thread.organizationId,
    target: { threadId: thread.id, from: thread.bugStatus, to: parsed.data.status, fixedIn: parsed.data.fixedIn || null },
  });
  revalidatePath("/support");
  revalidatePath(`/support/${thread.id}`);
}
