import { estimateCostCents } from "@/lib/support/bot-rules";

/**
 * Chamada ao modelo do assistente de ajuda (doc technical/26, secao 6.5). So o
 * servidor, com a chave `ANTHROPIC_API_KEY`; sem ela o assistente fica
 * desligado e o "Fale com a gente" segue direto para o suporte. O gasto vai
 * para a tabela de uso (limite mensal) e nunca inclui dado do aluno: o texto da
 * pessoa chega aqui ja mascarado.
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-haiku-5-5";
// Estimativa em centavos de real por milhao de tokens (ajuste pelo preco do modelo e o cambio).
const DEFAULT_CENTS_PER_MTOK = { input: 550, output: 2750 };

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export type ClaudeResult =
  | { ok: true; text: string; inputTokens: number; outputTokens: number; costCents: number }
  | { ok: false; reason: "off" | "error" };

export function botEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function centsPerMillion() {
  const read = (name: string, fallback: number) => {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  return {
    input: read("SUPPORT_BOT_CENTS_PER_MTOK_IN", DEFAULT_CENTS_PER_MTOK.input),
    output: read("SUPPORT_BOT_CENTS_PER_MTOK_OUT", DEFAULT_CENTS_PER_MTOK.output),
  };
}

export async function askClaude(input: { system: string; messages: ClaudeMessage[]; maxTokens?: number }): Promise<ClaudeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return { ok: false, reason: "off" };
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": API_VERSION, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.SUPPORT_BOT_MODEL?.trim() || DEFAULT_MODEL,
        max_tokens: input.maxTokens ?? 500,
        temperature: 0.2,
        system: input.system,
        messages: input.messages,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) return { ok: false, reason: "error" };
    const body = (await response.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (body.content ?? [])
      .filter((block) => block.type === "text" && block.text)
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!text) return { ok: false, reason: "error" };
    const inputTokens = body.usage?.input_tokens ?? 0;
    const outputTokens = body.usage?.output_tokens ?? 0;
    return { ok: true, text, inputTokens, outputTokens, costCents: estimateCostCents({ inputTokens, outputTokens }, centsPerMillion()) };
  } catch {
    return { ok: false, reason: "error" };
  }
}
