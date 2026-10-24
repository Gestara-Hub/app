// Modulo so do servidor, usado pelo cron diario (app/api/cron/daily) com o
// cliente administrativo. Sem "use server" de proposito: nao e action, entao o
// navegador nao chama com um organizationId qualquer (doc 15, fatia 2).

import { randomUUID } from "node:crypto";
import {
  membershipCompetencesToGenerate,
  planMembershipCharges,
} from "@gestarahub/core/membership-generation";
import type { BillingDefaults } from "@gestarahub/core/billing";
import { dateInSpace, resolveSpaceTimeZone } from "@gestarahub/core/date";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listChargesFromDb, listPlansFromDb } from "./billingBackend";
import { chargeToDbRow } from "./billingRows";
import { listClientsFromDb } from "../clients/clientsBackend";
import { listClassGroupsFromDb, listEnrollmentsFromDb } from "../classes/turmasBackend";
import { logError } from "@/lib/log";

/**
 * Mensalidades automaticas no servidor (doc 15, fatia 1). Le alunos, planos,
 * turmas, matriculas e mensalidades do banco, roda o mesmo planejamento puro
 * da demonstracao (`@gestarahub/core/membership-generation`) e grava pela
 * funcao `insert_membership_charges`, que ignora o periodo ja cobrado (indice
 * unico da migracao 25). Idempotente e segura com dois aparelhos ao mesmo tempo.
 * Devolve quantas mensalidades criou.
 */
export async function generateMembershipChargesAction(
  organizationId: string,
  requested: string[] = [],
): Promise<number> {
  const client = createSupabaseAdminClient();
  const [{ data: org }, { data: unit }, clients, plans, classGroups, enrollments, charges] = await Promise.all([
    client.from("organizations").select("settings").eq("id", organizationId).maybeSingle(),
    client.from("units").select("id, address").eq("organization_id", organizationId).limit(1).maybeSingle(),
    listClientsFromDb(organizationId),
    listPlansFromDb(organizationId),
    listClassGroupsFromDb(organizationId),
    listEnrollmentsFromDb(organizationId),
    listChargesFromDb(organizationId, { kind: "membership" }),
  ]);

  const world = {
    clients,
    plans,
    classGroups,
    enrollments,
    charges,
    settings: (org?.settings ?? undefined) as BillingDefaults | undefined,
    // Hoje no fuso do espaco, nao no do servidor (a rotina roda sem sessao).
    today: dateInSpace(new Date(), resolveSpaceTimeZone(org?.settings as { timeZone?: string } | undefined, unit?.address)),
  };
  const planned = planMembershipCharges(world, membershipCompetencesToGenerate(world, requested));
  if (planned.length === 0) return 0;

  const now = new Date().toISOString();
  const rows = planned.map((p) =>
    chargeToDbRow({
      ...p,
      id: randomUUID(),
      organizationId,
      unitId: unit?.id ? String(unit.id) : undefined,
      createdAt: now,
      updatedAt: now,
    }),
  );
  const { data: created, error } = await client.rpc("insert_membership_charges", {
    p_organization_id: organizationId,
    p_rows: rows,
  });
  if (error) {
    logError("[generateMembershipChargesAction] Erro ao gravar mensalidades:", error);
    throw new Error("Não foi possível gerar as mensalidades.");
  }
  return Number(created) || 0;
}
