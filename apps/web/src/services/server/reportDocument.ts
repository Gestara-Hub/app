import type { DocumentModel, ReportFilter, ReportType } from "@gestarahub/contracts";
import { getSegmentPreset, vocabularyForModality } from "@/lib/business-segment-presets";
import { reportToDocument } from "@/lib/documents/report-documents";
import { reportsServiceImpl } from "../reports";
import { runInWorld } from "../world/runWorld";
import { store } from "../world/store";
import type { TenantContext } from "./tenant";

/**
 * Relatorio do catalogo como documento, no servidor: roda o mesmo
 * `generateReport` da tela sobre o espaco da sessao (com as permissoes e o
 * plano que ele confere) e monta o `DocumentModel` com as palavras da area.
 * Modulo so do servidor.
 */
export async function buildReportDocument(
  ctx: TenantContext,
  type: ReportType,
  filter: ReportFilter,
): Promise<DocumentModel> {
  return runInWorld(ctx, async () => {
    const report = await reportsServiceImpl.generateReport(type, filter);
    const org = store.organization;
    const area = getSegmentPreset(
      org.classSegment,
      org.customSegmentProgression,
      org.customSegmentBilling,
    ).vocabulary;
    const categories = store.categories;
    return reportToDocument(report, filter.competence ?? "", {
      levelLabel: area.level,
      levelLabelForModality: (name) =>
        vocabularyForModality(categories.find((c) => c.name === name) ?? { name }, area).level,
    });
  });
}
