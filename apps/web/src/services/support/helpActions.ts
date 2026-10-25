"use server";

import { isDemoSpace } from "@/lib/demo";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { maskSensitive } from "@/lib/support/bot-rules";
import { runAction, type ActionResult } from "../server/action";
import { requireTenant } from "../server/tenant";

/**
 * Uso da ajuda do app (doc technical/26, 18.2): busca sem resultado e "isso
 * ajudou?". Serve só para melhorar os artigos, então nunca atrapalha quem usa:
 * na demonstração não grava, e passar do limite por minuto também não é erro.
 */

export type HelpEvent = { kind: "miss"; term: string; route?: string } | { kind: "helpful" | "not_helpful"; chunkId: string; route?: string };

export async function logHelpEventAction(event: HelpEvent): Promise<ActionResult<null>> {
  return runAction(async () => {
    const tenant = await requireTenant();
    if (isDemoSpace(tenant.organizationId)) return null;
    if (!(await checkRateLimit({ key: `help:${tenant.userId}`, maxRequests: 40, windowSeconds: 60 }))) return null;
    const term = event.kind === "miss" ? maskSensitive(event.term.trim()).slice(0, 120) : null;
    if (event.kind === "miss" && term!.length < 2) return null;
    const { error } = await createSupabaseAdminClient().rpc("help_log_event", {
      p_kind: event.kind,
      p_term: term,
      p_chunk: event.kind === "miss" ? null : event.chunkId.slice(0, 120),
      p_route: event.route ?? null,
      p_org: tenant.organizationId,
    });
    if (error) throw new Error(`help_log_event: ${error.message}`);
    return null;
  }, "help.log");
}
