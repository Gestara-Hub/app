"use server";

import { AsaasApiError, listWallets } from "@/lib/asaas";
import { logWarn, withErrorScope } from "@/lib/log";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordServerAudit, userActor } from "../server/systemAudit";
import { requireTenant } from "../server/tenant";
import { markApiKeyReplaced } from "./apiKeyHealth";

/**
 * Ultimo recurso quando a chave da subconta deixou de valer (27/11/2026, doc
 * product/19 "Chave de API da subconta"): o dono gera uma chave nova no Asaas
 * da propria conta de recebimento e cola aqui. So vale se for da mesma conta:
 * a carteira que a chave devolve (`GET /wallets`) precisa ser a do espaco. A
 * chave nunca vai para log, Auditoria ou resposta.
 */

export type ReplaceSubaccountKeyResult = { ok: true } | { ok: false; message: string };

const KEY_RE = /^\$aact_\S{20,500}$/;

export async function replaceSubaccountApiKeyAction(apiKey: string): Promise<ReplaceSubaccountKeyResult> {
  return withErrorScope(async () => {
    const ctx = await requireTenant();
    ctx.require("finance:manage");
    const key = typeof apiKey === "string" ? apiKey.trim() : "";
    if (!KEY_RE.test(key)) {
      return { ok: false, message: "Cole a chave inteira, como o Asaas mostra (começa com $aact_)." };
    }

    const admin = createSupabaseAdminClient();
    const { data: org } = await admin
      .from("organizations")
      .select("gateway_wallet_id")
      .eq("id", ctx.organizationId)
      .maybeSingle();
    const walletId = org?.gateway_wallet_id ? String(org.gateway_wallet_id) : "";
    if (!walletId) return { ok: false, message: "Ative a conta de recebimento antes de cadastrar uma chave." };

    let wallets: { id: string }[] = [];
    try {
      wallets = (await listWallets(key)).data ?? [];
    } catch (error) {
      if (error instanceof AsaasApiError && (error.status === 401 || error.status === 403)) {
        return { ok: false, message: "O Asaas não aceitou esta chave. Confira se copiou inteira e se ela está ativa." };
      }
      logWarn("[replaceSubaccountApiKeyAction] Chave não conferida no Asaas agora.");
      return { ok: false, message: "Não foi possível conferir a chave no Asaas agora. Tente de novo em instantes." };
    }
    if (!wallets.some((w) => w.id === walletId)) {
      return { ok: false, message: "Esta chave é de outra conta do Asaas. Gere a chave na conta de recebimento deste espaço." };
    }

    await admin.from("organizations").update({ gateway_api_key: key }).eq("id", ctx.organizationId).throwOnError();
    await markApiKeyReplaced(admin, ctx.organizationId);
    await recordServerAudit(admin, {
      organizationId: ctx.organizationId,
      actor: await userActor(admin, ctx),
      action: "updated",
      target: { type: "settings", id: ctx.organizationId, label: "Recebimentos online" },
      predicate: "cadastrou uma chave nova da conta de recebimento",
      security: true,
    });
    return { ok: true };
  });
}
