"use server";

import { headers } from "next/headers";
import type { ApiErrorField, PublicEventSignupInput, PublicEventSignupResult } from "@gestarahub/contracts";
import { isApiError } from "@gestarahub/contracts";
import { getClientIp } from "@/lib/security/rate-limit";
import { reportError } from "@/lib/log";
import { submitPublicEventSignup } from "@/services/server/eventPublicSignup";

export type EventSignupActionResult =
  | { ok: true; result: PublicEventSignupResult }
  | { ok: false; error: string; fields?: ApiErrorField[] };

/** Inscricao pelo link (pagina publica, sem login; travas no servico). */
export async function submitEventSignupAction(input: PublicEventSignupInput): Promise<EventSignupActionResult> {
  try {
    const userAgent = (await headers()).get("user-agent") ?? undefined;
    const result = await submitPublicEventSignup(input, { ip: await getClientIp(), userAgent });
    return { ok: true, result };
  } catch (error) {
    if (isApiError(error)) return { ok: false, error: error.message, ...(error.fields ? { fields: error.fields } : {}) };
    const reference = await reportError("public.event-signup", error, { source: "server" });
    return { ok: false, error: `Não foi possível concluir a inscrição. Tente de novo em instantes (código ${reference}).` };
  }
}
