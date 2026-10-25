"use server";

import { reportError } from "@/lib/log";
import { maskStack, maskText, maskValue } from "@/lib/log/mask";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { requireTenant } from "./tenant";

/**
 * Erros do navegador (doc technical/21). Quem esta logado manda o que
 * aconteceu (evento, mensagem, pilha, tela); espaco e usuario saem da sessao,
 * nunca do que o navegador mandou. Sem sessao (pagina publica), so o console do
 * navegador. Limite: 30 por usuario a cada 10 minutos (um erro em laco nao
 * enche a tabela; o mesmo erro tambem agrupa numa linha so).
 */
export interface BrowserErrorInput {
  event: string;
  level?: "error" | "warn";
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  /** Codigo ja mostrado na tela (o mesmo vai para a linha do registro). */
  reference?: string;
}

const REFERENCE = /^[A-HJ-NP-Z2-9]{8}$/;

export async function reportBrowserErrorAction(input: BrowserErrorInput): Promise<void> {
  try {
    const ctx = await requireTenant().catch(() => null);
    if (!ctx || typeof input?.message !== "string") return;
    const allowed = await checkRateLimit({ key: `browser-error:${ctx.userId}`, maxRequests: 30, windowSeconds: 600 });
    if (!allowed) return;
    const error = new Error(maskText(input.message.slice(0, 2000)));
    error.stack = typeof input.stack === "string" ? maskStack(input.stack.slice(0, 8000)) : undefined;
    await reportError(`browser.${String(input.event ?? "erro").slice(0, 80)}`, error, {
      source: "browser",
      level: input.level === "warn" ? "warn" : "error",
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      context: maskValue(input.context ?? {}) as Record<string, unknown>,
      reference: typeof input.reference === "string" && REFERENCE.test(input.reference) ? input.reference : undefined,
    });
  } catch {
    // Registrar erro do navegador nunca falha para quem mandou.
  }
}
