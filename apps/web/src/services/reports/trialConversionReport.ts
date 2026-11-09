import type { GeneratedReportData, TrialConversionReportData } from "@gestarahub/contracts";
import { firstDayOfCompetence, lastDayOfCompetence } from "@gestarahub/core/finance";
import { dateInSpace } from "@gestarahub/core/date";
import { store } from "@/services/world/store";
import { trialStudents } from "../clients/clientTrials";
import { assertFeature } from "../subscription/subscriptionService";
import { buildHeader } from "./reportCatalog";
import type { ReportContext } from "./reportContext";

/**
 * Aulas experimentais e conversao (09/11/2026): quem experimentou no mes,
 * quantos viraram alunos (matricula, plano ou pacote; aula avulsa nao conta),
 * em quanto tempo, e a lista de quem ainda nao voltou para chamar de volta.
 */
export async function buildTrialConversion({ competence, periodLabel }: ReportContext): Promise<GeneratedReportData> {
  assertFeature("reports_advanced");
  const today = dateInSpace();
  const first = firstDayOfCompetence(competence);
  const last = lastDayOfCompetence(competence);
  const all = trialStudents(store.clients, today);

  const inMonth = all.filter((t) => t.firstTrialAt && t.firstTrialAt >= first && t.firstTrialAt <= last);
  const convertedInMonth = inMonth.filter((t) => t.stage === "converted");
  const pendingAll = all.filter((t) => t.stage === "trial");
  const average = (values: number[]) =>
    values.length > 0 ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;

  const convertedBy = { enrollment: 0, plan: 0, package: 0 };
  for (const t of convertedInMonth) if (t.convertedBy) convertedBy[t.convertedBy] += 1;

  const data: TrialConversionReportData = {
    header: buildHeader(periodLabel),
    trialsInMonth: inMonth.length,
    convertedFromMonth: convertedInMonth.length,
    conversionRatePercent:
      inMonth.length > 0 ? Math.round((convertedInMonth.length / inMonth.length) * 1000) / 10 : null,
    averageDaysToConvert: average(convertedInMonth.map((t) => t.daysToConvert ?? 0)),
    pendingTotal: pendingAll.length,
    convertedBy,
    pending: pendingAll.map((t) => ({
      studentId: t.studentId,
      studentName: t.studentName,
      ...(t.phone ? { phone: t.phone } : {}),
      classGroupNames: t.classGroupNames,
      firstTrialAt: t.firstTrialAt ?? today,
      ...(t.lastTrialAt ? { lastTrialAt: t.lastTrialAt } : {}),
      trialCount: t.trialCount,
      daysSinceTrial: t.daysSinceTrial ?? null,
    })),
    converted: convertedInMonth
      .filter((t) => t.convertedAt && t.convertedBy)
      .sort((a, b) => (b.convertedAt ?? "").localeCompare(a.convertedAt ?? ""))
      .map((t) => ({
        studentId: t.studentId,
        studentName: t.studentName,
        firstTrialAt: t.firstTrialAt ?? today,
        convertedAt: t.convertedAt as string,
        convertedBy: t.convertedBy as "enrollment" | "plan" | "package",
        daysToConvert: t.daysToConvert ?? 0,
      })),
  };
  return { type: "trial_conversion", data };
}
