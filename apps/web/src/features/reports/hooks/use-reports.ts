import { useQuery } from "@tanstack/react-query";
import type { ReportFilter, ReportType } from "@gestarahub/contracts";
import { queryKeys } from "@/lib/queryKeys";
import { reportsService } from "@/services/reportsService";

export function useReportsCatalog() {
  return useQuery({
    queryKey: queryKeys.reports.catalog,
    queryFn: () => reportsService.getCatalog(),
  });
}

export function useReportData(type: ReportType | null, filter: ReportFilter = {}) {
  return useQuery({
    queryKey: queryKeys.reports.data(type || "none", filter as Record<string, unknown>),
    queryFn: () => (type ? reportsService.generateReport(type, filter) : null),
    enabled: Boolean(type),
  });
}
