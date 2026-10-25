"use server";

import { sanitizeCrumbs, type Crumb } from "@/lib/breadcrumbs";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenant } from "./tenant";

const REFERENCE = /^[A-HJ-NP-Z2-9]{8}$/;

/**
 * Completa a ocorrência de um erro de ação do servidor com os passos que o
 * navegador viu (doc technical/21). O servidor já gravou a ocorrência com o
 * código; aqui o navegador manda os últimos passos, e o banco só grava se a
 * ocorrência é da mesma pessoa e do mesmo espaço e ainda não tem passos. Nunca
 * atrapalha quem usa: falhar ou passar do limite é silêncio.
 */
export async function attachBreadcrumbsAction(input: { reference: string; crumbs: Crumb[] }): Promise<void> {
  try {
    const ctx = await requireTenant().catch(() => null);
    if (!ctx || typeof input?.reference !== "string" || !REFERENCE.test(input.reference)) return;
    const crumbs = sanitizeCrumbs(input.crumbs);
    if (crumbs.length === 0) return;
    if (!(await checkRateLimit({ key: `crumbs:${ctx.userId}`, maxRequests: 20, windowSeconds: 600 }))) return;
    await createSupabaseAdminClient().rpc("error_attach_breadcrumbs", {
      p_reference: input.reference,
      p_org: ctx.organizationId,
      p_user: ctx.userId,
      p_breadcrumbs: crumbs,
    });
  } catch {
    // O rastro é ajuda para a equipe; nunca derruba a tela.
  }
}
