import { WORLD_COLLECTIONS } from "../world/tables";
import type { MethodSlice, SliceLoader } from "../world/slices";

/**
 * Recortes de cobrancas (doc 19, fase 2). A leitura de cobrancas gera as
 * mensalidades que faltam, aplica o Pix Automatico e o "em atraso" vale para
 * todos os meses: o recorte e o espaco sem o historico que cobranca nao usa
 * (presencas, mensagens, avaliacoes, lancamentos do financeiro). As presencas
 * sao a maior parte das linhas de um espaco com tempo de uso.
 * Conferido nos testes contra o espaco inteiro (`WORLD_SLICE_CHECK=1`).
 */
const NOT_USED_BY_BILLING = new Set([
  "attendances",
  "messageLogs",
  "messageTemplates",
  "assessments",
  "studentMeasurements",
  "personDocuments",
  "financialEntries",
  "financialRecurrences",
  "financialCategories",
  "teacherPayRules",
  "waitlist",
  "sessionOverrides",
]);

/** O espaco sem o historico que cobranca nao usa (tambem a base dos lembretes). */
export async function billingWorld(load: SliceLoader): Promise<void> {
  await Promise.all(
    WORLD_COLLECTIONS.filter((c) => c.kind === "list" && !c.appendOnly && !NOT_USED_BY_BILLING.has(c.key)).map((c) =>
      load.all(c.key),
    ),
  );
  load.none("auditLog");
}

const billing: MethodSlice = async (_args, load) => billingWorld(load);

export const billingSlices: Record<string, MethodSlice> = Object.fromEntries(
  [
    "listCharges",
    "listChargesPaginated",
    "generateCharges",
    "createExtraCharge",
    "markPaid",
    "markPending",
    "cancelCharge",
    "reopenCharge",
  ].map((name) => [name, billing]),
);
