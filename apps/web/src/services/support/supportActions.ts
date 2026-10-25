"use server";

import { headers } from "next/headers";
import { forbiddenError, validationError } from "@gestarahub/core/api-error";
import { isDemoSpace } from "@/lib/demo";
import { sendSupportNotice } from "@/lib/email/support-mail";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  QUOTA_MESSAGES,
  buildSystemPrompt,
  checkQuota,
  looksUrgent,
  maskSensitive,
  parseReply,
  sourcesOf,
  subjectFrom,
  summaryFrom,
  type BotQuota,
} from "@/lib/support/bot-rules";
import { clientInfoText } from "@/lib/support/client-info";
import { searchHelp } from "@/lib/support/help-search";
import { runAction, type ActionResult } from "../server/action";
import { askClaude, botEnabled, type ClaudeMessage } from "../server/supportBot";
import { requireTenant } from "../server/tenant";
import type { SupportKind, SupportMessage, SupportStatus, SupportThreadSummary, SupportThreadView } from "./supportTypes";
import { dbError } from "@/lib/log";

/**
 * "Fale com a gente" do app dos clientes (doc technical/26, fase 1). Cada acao
 * confere a sessao (`requireTenant`) e so entao fala com as funcoes
 * `public.support_*` pela chave de servico, sempre com o espaco e o usuario da
 * sessao (nunca de argumento do navegador). Nao existe na demonstracao.
 */

const MAX_MESSAGE = 2000;
const HISTORY_FOR_BOT = 6;

type Admin = ReturnType<typeof createSupabaseAdminClient>;

async function caller() {
  const tenant = await requireTenant();
  if (isDemoSpace(tenant.organizationId)) {
    throw forbiddenError("O Fale com a gente está disponível só na conta real do seu espaço.");
  }
  const admin = createSupabaseAdminClient();
  const { data: user } = await admin.from("users").select("name, email").eq("id", tenant.userId).maybeSingle();
  const { data: org } = await admin.from("organizations").select("name, subscription").eq("id", tenant.organizationId).maybeSingle();
  if (!user) throw forbiddenError();
  const tier = (org?.subscription as { tier?: string } | null)?.tier ?? "free";
  return {
    admin,
    org: tenant.organizationId,
    userId: tenant.userId,
    profile: tenant.profile,
    userName: String(user.name),
    userEmail: String(user.email),
    spaceName: String(org?.name ?? ""),
    tier,
  };
}

async function rpc<T>(admin: Admin, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) {
    if (error.code === "P0002" || error.code === "22023") throw validationError([{ field: "message", message: error.message }]);
    throw dbError(`${fn}`, error);
  }
  return data as T;
}

interface MessageRow {
  id: string;
  author: SupportMessage["author"];
  staff_name: string | null;
  body: string;
  sources: SupportMessage["sources"] | null;
  created_at: string;
}

const toMessage = (row: MessageRow): SupportMessage => ({
  id: row.id,
  author: row.author,
  ...(row.staff_name ? { staffName: row.staff_name } : {}),
  body: row.body,
  ...(row.sources ? { sources: row.sources } : {}),
  createdAt: row.created_at,
});

async function threadView(
  c: Awaited<ReturnType<typeof caller>>,
  threadId: string,
  extra: { needsHuman?: boolean } = {},
): Promise<SupportThreadView> {
  const [messages, statusRows, quota] = await Promise.all([
    rpc<MessageRow[]>(c.admin, "support_thread_messages", { p_org: c.org, p_user: c.userId, p_thread: threadId, p_mark_seen: true }),
    rpc<{ number: number; status: SupportStatus; bot_helped: boolean | null; subject: string; kind: SupportKind }[]>(c.admin, "support_thread_status", {
      p_org: c.org,
      p_user: c.userId,
      p_thread: threadId,
    }),
    rpc<BotQuota>(c.admin, "support_bot_quota", { p_org: c.org, p_user: c.userId }),
  ]);
  const status = statusRows[0];
  if (!status) throw validationError([{ field: "message", message: "Conversa não encontrada." }]);
  return {
    threadId,
    number: status.number,
    kind: status.kind,
    status: status.status,
    subject: status.subject,
    botHelped: status.bot_helped,
    messages: messages.map(toMessage),
    needsHuman: extra.needsHuman ?? false,
    botAvailable: botEnabled() && checkQuota(quota).ok,
  };
}

/** Conversa que o assistente atende (ainda nao foi para o suporte). */
async function answerWithBot(c: Awaited<ReturnType<typeof caller>>, threadId: string, question: string): Promise<{ needsHuman: boolean }> {
  const addBot = (body: string, sources: unknown, usage = { input: 0, output: 0, cost: 0 }) =>
    rpc<void>(c.admin, "support_add_bot_message", {
      p_thread: threadId,
      p_body: body,
      p_sources: sources ?? null,
      p_input_tokens: usage.input,
      p_output_tokens: usage.output,
      p_cost_cents: usage.cost,
    });

  if (!botEnabled()) {
    await addBot(QUOTA_MESSAGES.off, null);
    return { needsHuman: true };
  }
  const quota = await rpc<BotQuota>(c.admin, "support_bot_quota", { p_org: c.org, p_user: c.userId });
  const verdict = checkQuota(quota);
  if (!verdict.ok) {
    await addBot(QUOTA_MESSAGES[verdict.reason], null);
    return { needsHuman: true };
  }

  const history = await rpc<MessageRow[]>(c.admin, "support_thread_messages", { p_org: c.org, p_user: c.userId, p_thread: threadId, p_mark_seen: false });
  const messages: ClaudeMessage[] = history
    .filter((m) => m.author === "customer" || m.author === "bot")
    .slice(-HISTORY_FOR_BOT)
    .map((m) => ({ role: m.author === "customer" ? ("user" as const) : ("assistant" as const), content: maskSensitive(m.body) }));
  // A conversa tem que comecar e terminar com a pessoa (regra da API).
  while (messages.length > 0 && messages[0].role === "assistant") messages.shift();

  const hits = searchHelp(question, 4);
  const result = await askClaude({ system: buildSystemPrompt(hits), messages });
  if (!result.ok) {
    await addBot(QUOTA_MESSAGES.error, null);
    return { needsHuman: true };
  }
  const parsed = parseReply(result.text);
  const needsHuman = parsed.needsHuman || hits.length === 0;
  await addBot(parsed.text, hits.length > 0 && !parsed.needsHuman ? sourcesOf(hits) : null, {
    input: result.inputTokens,
    output: result.outputTokens,
    cost: result.costCents,
  });
  return { needsHuman };
}

export async function listSupportThreadsAction(): Promise<ActionResult<SupportThreadSummary[]>> {
  return runAction(async () => {
    const c = await caller();
    const rows = await rpc<
      { id: string; number: number; subject: string; status: SupportStatus; urgent: boolean; created_at: string; last_message_at: string; unread: number; last_preview: string | null; kind: SupportKind }[]
    >(c.admin, "support_list_threads", { p_org: c.org, p_user: c.userId });
    return rows.map((r) => ({
      id: r.id,
      number: r.number,
      kind: r.kind,
      subject: r.subject,
      status: r.status,
      urgent: r.urgent,
      createdAt: r.created_at,
      lastMessageAt: r.last_message_at,
      unread: r.unread,
      lastPreview: r.last_preview ?? "",
    }));
  }, "support.list");
}

export async function getSupportThreadAction(threadId: string): Promise<ActionResult<SupportThreadView>> {
  return runAction(async () => threadView(await caller(), threadId), "support.get");
}

export async function sendSupportMessageAction(input: {
  threadId?: string;
  message: string;
  origin?: string;
  errorReference?: string;
  /** Só vale ao abrir a conversa; sem tipo é uma dúvida. */
  kind?: SupportKind;
}): Promise<ActionResult<SupportThreadView>> {
  return runAction(async () => {
    const c = await caller();
    // CPF, CNPJ, e-mail, telefone e cartao nunca ficam guardados (a equipe ve a conversa inteira).
    const message = maskSensitive(input.message.trim());
    if (!message.trim()) throw validationError([{ field: "message", message: "Escreva a mensagem." }]);
    if (message.length > MAX_MESSAGE) throw validationError([{ field: "message", message: `Use no máximo ${MAX_MESSAGE} caracteres.` }]);
    if (!(await checkRateLimit({ key: `support:${c.userId}`, maxRequests: 12, windowSeconds: 60 }))) {
      throw validationError([{ field: "message", message: "Muitas mensagens em pouco tempo. Aguarde um minuto." }]);
    }

    let threadId = input.threadId;
    let before: SupportStatus = "bot";
    let number = 0;
    if (!threadId) {
      threadId = await rpc<string>(c.admin, "support_open_thread", {
        p_org: c.org,
        p_user: c.userId,
        p_name: c.userName,
        p_email: c.userEmail,
        p_phone: null,
        p_subject: subjectFrom(message),
        p_first_message: message,
        p_origin: input.origin ?? null,
        p_error_ref: input.errorReference ?? null,
        p_tier: c.tier,
        p_kind: input.kind ?? "question",
        // Só no problema relatado: ajuda a reproduzir o erro.
        p_client_info:
          input.kind === "bug"
            ? clientInfoText({
                userAgent: (await headers()).get("user-agent"),
                profile: c.profile,
                version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
              })
            : null,
      });
    } else {
      const status = (await rpc<{ status: SupportStatus; number: number }[]>(c.admin, "support_thread_status", { p_org: c.org, p_user: c.userId, p_thread: threadId }))[0];
      if (!status) throw validationError([{ field: "message", message: "Conversa não encontrada." }]);
      before = status.status;
      number = status.number;
      await rpc<void>(c.admin, "support_add_customer_message", { p_org: c.org, p_user: c.userId, p_thread: threadId, p_body: message });
    }

    let needsHuman = false;
    if (!input.threadId && input.kind && input.kind !== "question") {
      // Problema e sugestao nao passam pelo assistente: vao direto para a equipe.
      await escalate(c, threadId);
    } else if (before === "bot") {
      ({ needsHuman } = await answerWithBot(c, threadId, message));
    } else {
      // Conversa que ja esta com o suporte: avisa que a pessoa respondeu.
      const notifyTo = await rpc<string>(c.admin, "support_notify_email", {});
      await sendSupportNotice(
        { kind: "reply", number, urgent: false, subject: subjectFrom(message), spaceName: c.spaceName, userName: c.userName, userEmail: c.userEmail, preview: message.slice(0, 600) },
        notifyTo,
      );
    }
    return threadView(c, threadId, { needsHuman });
  }, "support.send");
}

/** A conversa passa a ser nossa e chega o aviso por e-mail. */
async function escalate(c: Awaited<ReturnType<typeof caller>>, threadId: string): Promise<void> {
  const history = await rpc<MessageRow[]>(c.admin, "support_thread_messages", { p_org: c.org, p_user: c.userId, p_thread: threadId, p_mark_seen: false });
  const customerTexts = history.filter((m) => m.author === "customer").map((m) => m.body);
  const urgent = looksUrgent(customerTexts);
  const summary = summaryFrom(customerTexts);
  const rows = await rpc<{ number: number; subject: string; user_name: string; user_email: string; organization_name: string; urgent: boolean; kind: SupportKind; origin_screen: string | null; error_reference: string | null }[]>(
    c.admin,
    "support_escalate",
    { p_org: c.org, p_user: c.userId, p_thread: threadId, p_summary: summary, p_urgent: urgent },
  );
  const sent = rows[0];
  if (sent) {
    const notifyTo = await rpc<string>(c.admin, "support_notify_email", {});
    await sendSupportNotice(
      { kind: "new", number: sent.number, topic: sent.kind, urgent: sent.urgent, subject: sent.subject, spaceName: sent.organization_name, userName: sent.user_name, userEmail: sent.user_email, originScreen: sent.origin_screen ?? undefined, errorReference: sent.error_reference ?? undefined, preview: summary },
      notifyTo,
    );
  }
}

/** "Falar com o suporte". */
export async function escalateSupportThreadAction(threadId: string): Promise<ActionResult<SupportThreadView>> {
  return runAction(async () => {
    const c = await caller();
    await escalate(c, threadId);
    return threadView(c, threadId);
  }, "support.escalate");
}

export async function markSupportBotHelpedAction(threadId: string, helped: boolean): Promise<ActionResult<SupportThreadView>> {
  return runAction(async () => {
    const c = await caller();
    await rpc<void>(c.admin, "support_mark_bot_helped", { p_org: c.org, p_user: c.userId, p_thread: threadId, p_helped: helped });
    return threadView(c, threadId);
  }, "support.helped");
}

export async function supportUnreadCountAction(): Promise<ActionResult<number>> {
  return runAction(async () => {
    const c = await caller();
    return rpc<number>(c.admin, "support_unread_count", { p_org: c.org, p_user: c.userId });
  }, "support.unread");
}
