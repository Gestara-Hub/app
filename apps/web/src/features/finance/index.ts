// Barrel publico do Financeiro (plano pago). Ver docs/technical/05.
export { FinanceView } from "./components/finance-view";
export { FinanceSummaryTab } from "./components/finance-summary-tab";
export { FinanceEntriesTab } from "./components/finance-entries-tab";
export { TeacherPayTab } from "./components/teacher-pay-tab";
export { CompetencePicker } from "./components/competence-picker";
export { useFinanceUrlState } from "./hooks/use-finance-url-state";
export {
  DEFAULT_FINANCE_TAB,
  FINANCE_TABS,
  competenceLabel,
  competenceShortLabel,
  currentCompetence,
  financeHref,
  isCompetence,
  isFinanceTab,
  type FinanceTab,
} from "./lib";
export { FINANCE_BENEFITS } from "./benefits";
export type { SummaryViewMode } from "./components/finance-summary-tab";
