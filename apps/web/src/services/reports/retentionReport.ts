import type { ChurnReportData, GeneratedReportData } from "@gestarahub/contracts";
import { firstDayOfCompetence, lastDayOfCompetence, localDateOf } from "@gestarahub/core/finance";
import { addDays, format, parseISO } from "date-fns";
import { store } from "@/services/world/store";
import { assertFeature } from "../subscriptionService";
import { buildHeader } from "./reportCatalog";
import type { ReportContext } from "./reportContext";

/** Retencao de alunos no mes, por turma. */

export async function buildChurnRetention({ competence, periodLabel }: ReportContext): Promise<GeneratedReportData> {
    assertFeature("reports_advanced");

    // Pelas matriculas: aluno ativo = com alguma matricula valendo no dia.
    const first = firstDayOfCompetence(competence);
    const monthEnd = lastDayOfCompetence(competence);
    const today = format(new Date(), "yyyy-MM-dd");
    const endDay = monthEnd < today ? monthEnd : today;
    const dayBefore = format(addDays(parseISO(first), -1), "yyyy-MM-dd");
    const validOn = (e: (typeof store.enrollments)[number], date: string) =>
      localDateOf(e.enrolledAt) <= date &&
      (e.status !== "canceled" || (e.canceledAt !== undefined && localDateOf(e.canceledAt) > date));
    const activeOn = (date: string, classGroupId?: string) =>
      new Set(
        store.enrollments
          .filter((e) => (!classGroupId || e.classGroupId === classGroupId) && validOn(e, date))
          .map((e) => e.studentId),
      );
    const startSet = activeOn(dayBefore);
    const endSet = activeOn(endDay);
    const newEnrollments = [...endSet].filter((id) => !startSet.has(id)).length;
    const cancellations = [...startSet].filter((id) => !endSet.has(id)).length;
    const oneDecimal = (n: number) => Math.round(n * 10) / 10;
    const churnRatePercent = startSet.size > 0 ? oneDecimal((cancellations / startSet.size) * 100) : 0;

    // Por turma: ativos no fim e quem saiu dela no mes.
    const modalitiesBreakdown = store.classGroups
      .map((cg) => {
        const before = activeOn(dayBefore, cg.id);
        const after = activeOn(endDay, cg.id);
        const left = [...before].filter((id) => !after.has(id)).length;
        return {
          modalityName: cg.name,
          activeCount: after.size,
          churnRatePercent: before.size > 0 ? oneDecimal((left / before.size) * 100) : 0,
        };
      })
      .filter((row) => row.activeCount > 0 || row.churnRatePercent > 0);

    const data: ChurnReportData = {
      header: buildHeader(periodLabel),
      activeStudentsStart: startSet.size,
      newEnrollments,
      cancellations,
      activeStudentsEnd: endSet.size,
      netGrowth: endSet.size - startSet.size,
      churnRatePercent,
      retentionRatePercent: startSet.size > 0 ? oneDecimal(100 - churnRatePercent) : 0,
      modalitiesBreakdown,
    };

    return { type: "churn_retention", data };
}
