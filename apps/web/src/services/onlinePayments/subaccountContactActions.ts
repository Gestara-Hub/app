"use server";

import type { Address } from "@gestarahub/contracts";
import { getCommercialInfo, updateCommercialInfo } from "@/lib/asaas";
import { logError } from "@/lib/log";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenant } from "../server/tenant";
import { buildCommercialInfoUpdate } from "./subaccountContact";

/**
 * Leva o telefone e o endereco de Configuracoes para o topo da fatura do
 * parceiro (dados comerciais da subconta, 13/11/2026). Chamada depois de
 * salvar Configuracoes; le o que esta salvo no banco (nao o que a tela manda).
 * Sem subconta, nao faz nada. Falha aqui nunca desfaz o salvar.
 */

export interface SubaccountContactSyncResult {
  /** "skipped": sem subconta ou nada mudou; "pending": o parceiro vai conferir. */
  status: "skipped" | "updated" | "pending" | "failed";
  message?: string;
}

export async function syncSubaccountContactAction(): Promise<SubaccountContactSyncResult> {
  const tenant = await requireTenant();
  tenant.require("settings:view");
  const admin = createSupabaseAdminClient();
  const [{ data: org }, { data: unit }] = await Promise.all([
    admin.from("organizations").select("gateway_api_key").eq("id", tenant.organizationId).maybeSingle(),
    admin
      .from("units")
      .select("phone, address")
      .eq("organization_id", tenant.organizationId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  const apiKey = (org?.gateway_api_key as string | null | undefined) ?? undefined;
  if (!apiKey || !process.env.ASAAS_API_KEY) return { status: "skipped" };

  try {
    const current = await getCommercialInfo(apiKey);
    const { payload, changed } = buildCommercialInfoUpdate(current, {
      phone: (unit?.phone as string | null | undefined) ?? undefined,
      address: (unit?.address as Partial<Address> | null | undefined) ?? undefined,
    });
    if (changed.length === 0) return { status: "skipped" };
    const saved = await updateCommercialInfo(apiKey, payload);
    const status = String(saved.status ?? "");
    if (status === "DENIED") {
      return { status: "failed", message: String(saved.denialReason ?? "O parceiro de pagamentos recusou os dados.") };
    }
    if (status === "PENDING" || status === "AWAITING_ACTION_AUTHORIZATION") return { status: "pending" };
    return { status: "updated" };
  } catch (error) {
    logError("[subaccountContact] Falha ao atualizar os dados da fatura no parceiro:", error);
    const message = error instanceof Error && error.message ? error.message : "Tente salvar de novo em instantes.";
    return { status: "failed", message };
  }
}
