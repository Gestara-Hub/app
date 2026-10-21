import { cashFlowService } from "./cashFlowService";
import { entryStatusService } from "./entryStatusService";
import { financeCategoriesService } from "./financeCategoriesService";
import { financeRecurrenceService } from "./financeRecurrenceService";
import { transactionsService } from "./transactionsService";
import { teacherPayClosingService } from "./teacherPayClosingService";
import { teacherPayPaymentsService } from "./teacherPayPaymentsService";
import { teacherPayRulesService } from "./teacherPayRulesService";
import { delegateAll } from "../world/delegate";

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

export const financeServiceImpl = {
  ...cashFlowService,
  ...transactionsService,
  ...entryStatusService,
  ...financeRecurrenceService,
  ...financeCategoriesService,
};

/** Conta real no navegador: roda no servidor sobre o banco (doc 15, fatia 2). */
export const financeService = delegateAll("finance", financeServiceImpl);

/**
 * Pagamento dos professores (Financeiro basico, gratis). Regra por professor,
 * previa do mes calculada na leitura (motor puro em @gestarahub/core/finance),
 * fechamento que congela as linhas e pagamento que entra no caixa como saida da
 * categoria de sistema "Professores" (o financeService le `teacherPayouts`
 * pagos). Especificacao: docs/technical/05, secao 5.
 */

export const teacherPayServiceImpl = {
  ...teacherPayRulesService,
  ...teacherPayClosingService,
  ...teacherPayPaymentsService,
};

/** Conta real no navegador: roda no servidor sobre o banco (doc 15, fatia 2). */
export const teacherPayService = delegateAll("teacherPay", teacherPayServiceImpl);
