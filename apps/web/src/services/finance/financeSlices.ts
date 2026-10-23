import { WORLD_COLLECTIONS } from "../world/tables";
import type { MethodSlice, SliceLoader } from "../world/slices";

/**
 * Recortes do financeiro e do pagamento de professores (doc 19, fase 2). O
 * caixa soma cobrancas, lancamentos e pagamentos de professor, e a previa do
 * professor conta matriculas, aulas avulsas e pacotes; nada disso usa o
 * historico de presencas, mensagens e avaliacoes, que e a maior parte das
 * linhas de um espaco com tempo de uso: o recorte e o espaco sem eles.
 * Conferido nos testes contra o espaco inteiro (`WORLD_SLICE_CHECK=1`).
 */
const NOT_USED_BY_FINANCE = new Set(["attendances", "messageLogs", "messageTemplates", "assessments", "waitlist"]);

async function financeWorld(load: SliceLoader): Promise<void> {
  await Promise.all(
    WORLD_COLLECTIONS.filter((c) => c.kind === "list" && !c.appendOnly && !NOT_USED_BY_FINANCE.has(c.key)).map((c) =>
      load.all(c.key),
    ),
  );
  // Auditoria so dos lancamentos ("ja foi pago uma vez" vem dela; o resto so acrescenta).
  await load.all("auditLog");
}

const finance: MethodSlice = async (_args, load) => financeWorld(load);
const sliced = (names: string[]) => Object.fromEntries(names.map((name) => [name, finance]));

export const financeSlices: Record<string, MethodSlice> = sliced([
  "getSummary",
  "getMonthlySeries",
  "getByCategory",
  "getUpcoming",
  "listEntries",
  "listCategories",
  "createEntry",
  "updateEntry",
  "deleteEntry",
  "markEntryPaid",
  "markEntryPending",
  "cancelEntry",
  "endRecurrence",
  "createCategory",
  "updateCategory",
  "applyRecurringAutoPayments",
]);

export const teacherPaySlices: Record<string, MethodSlice> = sliced([
  "listTeachers",
  "listRules",
  "listPayouts",
  "getPayoutPreview",
  "saveRule",
  "saveAdjustments",
  "closePayout",
  "reopenPayout",
  "markPayoutPaid",
  "markPayoutUnpaid",
]);
