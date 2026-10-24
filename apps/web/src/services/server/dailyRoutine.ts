import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditEntityType } from "@gestarahub/contracts";
import { reportError } from "@/lib/log";
import { generateMembershipChargesWithSummary } from "@/services/billing/membershipBackend";
import { materializeRecurrencesWithSummary } from "@/services/finance/financeBackend";
import { recordSystemAudit } from "./systemAudit";

/**
 * Tarefas da rotina diaria por espaco (doc 15, fatia 1), com o resumo na
 * Auditoria (doc technical/23): o que foi criado sai numa linha por espaco e
 * tarefa ("gerou 12 mensalidades", com a lista); a falha sai com o codigo do
 * registro de erros. Sem nada a fazer, nada na Auditoria. Modulo so do servidor.
 */

/** Itens listados no detalhe da linha; o resto vira "e mais N". */
const MAX_LISTED = 50;

export interface DailySpaceTotals {
  membershipCharges: number;
  recurrenceEntries: number;
  failures: number;
  errorReferences: string[];
}

interface DailyTask {
  event: string;
  run: (organizationId: string) => Promise<{ count: number; items: string[] }>;
  target: { type: AuditEntityType; label: string };
  label: string;
  /** "gerou 12 mensalidades" */
  done: (count: number) => string;
  failed: string;
  total: "membershipCharges" | "recurrenceEntries";
  /** Dinheiro e Financeiro: so o dono ve (mesma regra da Auditoria das pessoas). */
  security: boolean;
}

const TASKS: DailyTask[] = [
  {
    event: "cron.daily.mensalidades",
    run: (id) => generateMembershipChargesWithSummary(id),
    target: { type: "charge", label: "Mensalidades automáticas" },
    label: "Criadas",
    done: (n) => `gerou ${n} ${n === 1 ? "mensalidade" : "mensalidades"}`,
    failed: "não conseguiu gerar as mensalidades",
    total: "membershipCharges",
    security: false,
  },
  {
    event: "cron.daily.recorrencias",
    run: (id) => materializeRecurrencesWithSummary(id),
    target: { type: "financial_entry", label: "Lançamentos repetidos" },
    label: "Lançados",
    done: (n) => `lançou ${n} ${n === 1 ? "lançamento repetido" : "lançamentos repetidos"} no Financeiro`,
    failed: "não conseguiu lançar os repetidos do Financeiro",
    total: "recurrenceEntries",
    security: false,
  },
];

/** Uma tarefa com problema nao impede a outra; o dia seguinte tenta de novo. */
export async function runDailySpaceTasks(
  admin: SupabaseClient,
  organizationId: string,
  totals: DailySpaceTotals,
): Promise<void> {
  for (const task of TASKS) {
    try {
      const { count, items } = await task.run(organizationId);
      totals[task.total] += count;
      if (count === 0) continue;
      const listed = items.slice(0, MAX_LISTED).join("; ");
      const more = items.length > MAX_LISTED ? ` e mais ${items.length - MAX_LISTED}` : "";
      await recordSystemAudit(admin, "cron.daily", {
        organizationId,
        action: "created",
        target: task.target,
        predicate: task.done(count),
        changes: listed ? [{ field: "items", label: task.label, before: "—", after: `${listed}${more}` }] : undefined,
        security: task.security,
      });
    } catch (error) {
      totals.failures += 1;
      const reference = await reportError(task.event, error, { source: "cron", organizationId });
      totals.errorReferences.push(reference);
      await recordSystemAudit(admin, "cron.daily", {
        organizationId,
        action: "created",
        target: task.target,
        predicate: `${task.failed} (código ${reference})`,
        security: task.security,
        failed: true,
        errorReference: reference,
      });
    }
  }
}
