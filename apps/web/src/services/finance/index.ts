import { cashFlowService } from "./cashFlowService";
import { entryStatusService } from "./entryStatusService";
import { financeCategoriesService } from "./financeCategoriesService";
import { financeRecurrenceService } from "./financeRecurrenceService";
import { transactionsService } from "./transactionsService";
import { teacherPayClosingService } from "./teacherPayClosingService";
import { teacherPayPaymentsService } from "./teacherPayPaymentsService";
import { teacherPayRulesService } from "./teacherPayRulesService";

export {
  cashFlowService,
  entryStatusService,
  financeCategoriesService,
  financeRecurrenceService,
  transactionsService,
  teacherPayClosingService,
  teacherPayPaymentsService,
  teacherPayRulesService,
};
export { syncFinanceFromDb } from "./financeStore";
export { syncTeacherPayFromDb } from "./teacherPayStore";
export { openPayoutPreviews } from "./teacherPayViews";
export type {
  OpenPayoutPreview,
  TeacherPayDetailSession,
  TeacherPayoutDetail,
  TeacherPayTeacher,
} from "./teacherPayViews";

/**
 * Financeiro do negocio (basico, gratis). Le as cobrancas dos alunos (Charge) e os
 * pagamentos de professores (TeacherPayout) como fontes de caixa, sem duplicar;
 * `FinancialEntry` cobre so os lancamentos manuais. Recorrencias materializam
 * de forma idempotente em toda leitura, ate o mes seguinte ao atual.
 * Datas sempre pela data LOCAL. Especificacao: docs/technical/05.
 */

// --- Service ----------------------------------------------------------------

export const financeService = {
  ...cashFlowService,
  ...transactionsService,
  ...entryStatusService,
  ...financeRecurrenceService,
  ...financeCategoriesService,
};

/**
 * Pagamento dos professores (Financeiro basico, gratis). Regra por professor,
 * previa do mes calculada na leitura (motor puro em @gestarahub/core/finance),
 * fechamento que congela as linhas e pagamento que entra no caixa como saida da
 * categoria de sistema "Professores" (o financeService le `teacherPayouts`
 * pagos). Especificacao: docs/technical/05, secao 5.
 */

export const teacherPayService = {
  ...teacherPayRulesService,
  ...teacherPayClosingService,
  ...teacherPayPaymentsService,
};
