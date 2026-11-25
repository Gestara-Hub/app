"use server";

import type { SubaccountOnboardingView } from "@gestarahub/contracts";
import { runAction, type ActionResult } from "../server/action";
import { requireTenant } from "../server/tenant";
import { loadSubaccountOnboarding } from "./accountStatus";

/**
 * Cartao "Deixe sua conta pronta" (25/11/2026): situacao da analise no Asaas e
 * os documentos que faltam, lidos na hora com a chave da subconta. Espaco da
 * sessao, nunca do navegador.
 */
export async function getSubaccountOnboardingAction(): Promise<ActionResult<SubaccountOnboardingView | null>> {
  return runAction(async () => {
    const ctx = await requireTenant();
    ctx.require("finance:view");
    return loadSubaccountOnboarding(ctx.organizationId);
  }, "onlinePayments.onboarding");
}
