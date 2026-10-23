import type { ReportFilter } from "@gestarahub/contracts";

/** Mes do relatorio, o rotulo do periodo e os filtros da tela. */
export interface ReportContext {
  competence: string;
  periodLabel: string;
  filter: ReportFilter;
}
