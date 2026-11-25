"use server";

import { withErrorScope } from "@/lib/log";

import type { MessageLog, MessageLogFilter, PaginatedResult } from "@gestarahub/contracts";
import { requireTenant } from "../server/tenant";
import { messageLogPageFor } from "./messageLogPage";

/** Uma pagina do historico de mensagens do espaco da sessao (doc 19, secao 12). */
export async function listMessageLogPage(filter: MessageLogFilter | undefined): Promise<PaginatedResult<MessageLog>> {
  return withErrorScope(async () => {
    const ctx = await requireTenant();
    ctx.require("communication:view");
    return messageLogPageFor(ctx, filter);
  });
}
