import type { ReportType } from "@gestarahub/contracts";
import { requirePermission } from "@/features/auth/require-permission";
import { ReportsView } from "@/features/reports";

interface ReportsPageProps {
  searchParams: Promise<{
    type?: string;
    period?: string;
  }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  await requirePermission("reports:view", "/reports");
  const params = await searchParams;

  return (
    <ReportsView
      initialReportType={(params.type as ReportType) || null}
      initialCompetence={params.period}
    />
  );
}
