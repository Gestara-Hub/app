import type { ReportFilter, ReportType } from "@gestarahub/contracts";
import { dateInSpace } from "@gestarahub/core/date";
import { REPORT_FILE_SLUG } from "@/lib/documents/report-documents";
import { documentErrorResponse, documentResponse, formatFromRequest } from "@/services/server/documents";
import { buildReportDocument } from "@/services/server/reportDocument";
import { requireTenant } from "@/services/server/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMPETENCE_RE = /^\d{4}-\d{2}$/;

/**
 * Relatorio em PDF ou CSV, gerado no servidor com o layout dos documentos:
 * /api/documents/reports/<tipo>?competencia=2026-10&formato=pdf|csv
 * (lista de presenca: &turma=<id>&aula=<id>). Pede sessao, `reports:view` e
 * `reports:export`; permissao do relatorio e plano sao conferidos pelo servico.
 */
export async function GET(request: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!Object.hasOwn(REPORT_FILE_SLUG, type)) {
    return Response.json({ message: "Relatório não encontrado." }, { status: 404 });
  }
  const url = new URL(request.url);
  const competence = url.searchParams.get("competencia") ?? "";
  try {
    const ctx = await requireTenant();
    const filter: ReportFilter = {
      // Sem competencia: o mes atual no fuso do espaco.
      competence: COMPETENCE_RE.test(competence) ? competence : dateInSpace(new Date(), ctx.timeZone).slice(0, 7),
      classGroupId: url.searchParams.get("turma") || undefined,
      sessionId: url.searchParams.get("aula") || undefined,
    };
    ctx.require("reports:view");
    ctx.require("reports:export");
    const model = await buildReportDocument(ctx, type as ReportType, filter);
    return documentResponse(model, formatFromRequest(url), ctx.organizationId);
  } catch (error) {
    return documentErrorResponse(error);
  }
}
