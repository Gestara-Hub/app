import type { GeneratedReportData, ReportFilter, ReportMetadata, ReportType } from "@gestarahub/contracts";
import { apiError, notFoundError, readOp } from "@/services/world/ops";
import { delegateAll } from "../world/delegate";
import { CATALOG, REPORT_PERMISSION, actorCanSee } from "./reportCatalog";
import { buildAttendanceSheet, buildMonthlyBirthdays, buildStudentsRoster } from "./operationalReports";
import {
  buildBillingStatement,
  buildCourseSummary,
  buildIncomeStatement,
  buildPackageSummary,
} from "./financialReports";
import { buildChurnRetention } from "./retentionReport";
import { buildTrialConversion } from "./trialConversionReport";
import { dateInSpace } from "@gestarahub/core/date";

export const reportsServiceImpl = {
  getCatalog(): Promise<ReportMetadata[]> {
    return readOp(() =>
      CATALOG.filter((r) => actorCanSee(r.type)).map((r) => ({
        ...r,
        permissionRequired: REPORT_PERMISSION[r.type],
      })),
    );
  },

  generateReport(type: ReportType, filter: ReportFilter = {}): Promise<GeneratedReportData> {
    return readOp(async () => {
      if (!actorCanSee(type)) {
        throw apiError("FORBIDDEN", "Você não tem permissão para ver este relatório.", { httpStatus: 403 });
      }
      // Mes local (toISOString daria o mes seguinte depois das 21h no Brasil).
      const competence = filter.competence || dateInSpace().slice(0, 7);
      const [year, month] = competence.split("-");
      const periodLabel = `Competência ${month}/${year}`;

      const context = { competence, periodLabel, filter };
      switch (type) {
        case "attendance_sheet":
          return buildAttendanceSheet(context);
        case "students_roster":
          return buildStudentsRoster(context);
        case "billing_statement":
          return buildBillingStatement(context);
        case "course_summary":
          return buildCourseSummary(context);
        case "package_summary":
          return buildPackageSummary(context);
        case "monthly_birthdays":
          return buildMonthlyBirthdays(context);
        case "financial_income_statement":
          return buildIncomeStatement(context);
        case "churn_retention":
          return buildChurnRetention(context);
        case "trial_conversion":
          return buildTrialConversion(context);
        default:
          throw notFoundError("Relatório não encontrado.");
      }
    });
  },
};

/** Conta real no navegador: roda no servidor sobre o banco (doc 15, fatia 2). */
export const reportsService = delegateAll("reports", reportsServiceImpl);
