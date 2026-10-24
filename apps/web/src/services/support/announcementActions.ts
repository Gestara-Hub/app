"use server";

import { z } from "zod";
import { isDemoSpace } from "@/lib/demo";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runAction, type ActionResult } from "../server/action";
import { requireTenant } from "../server/tenant";

/**
 * Comunicados do GestaraHub (painel admin, doc technical/26, fase 5) para quem esta
 * no espaco: so os que valem para o espaco da pessoa e que ela ainda nao dispensou.
 * Passa pela sessao (`requireTenant`) e pela funcao do banco com a chave de servico.
 */
export interface AnnouncementView {
  id: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "urgent";
}

export async function listAnnouncementsAction(): Promise<ActionResult<AnnouncementView[]>> {
  return runAction(async () => {
    const tenant = await requireTenant();
    // Demonstracao nao recebe comunicado (e compartilhada).
    if (isDemoSpace(tenant.organizationId)) return [];
    const { data, error } = await createSupabaseAdminClient().rpc("announcements_for", { p_org: tenant.organizationId, p_user: tenant.userId });
    if (error) throw new Error(`announcements_for: ${error.message}`);
    return (data ?? []).map((row: { id: string; title: string; body: string; severity: AnnouncementView["severity"] }) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      severity: row.severity,
    }));
  }, "announcements.list");
}

export async function dismissAnnouncementAction(id: string): Promise<ActionResult<true>> {
  return runAction(async () => {
    const tenant = await requireTenant();
    const parsed = z.string().uuid().parse(id);
    const { error } = await createSupabaseAdminClient().rpc("announcement_dismiss", { p_org: tenant.organizationId, p_user: tenant.userId, p_id: parsed });
    if (error) throw new Error(`announcement_dismiss: ${error.message}`);
    return true as const;
  }, "announcements.dismiss");
}
