import type { ReportFilter, ReportType } from "@gestarahub/contracts";
import { REPORT_FILE_SLUG } from "@/lib/documents/report-documents";
import { documentErrorResponse, documentResponse, formatFromRequest } from "@/services/server/documents";
import { buildReportDocument } from "@/services/server/reportDocument";
import { requireTenant } from "@/services/server/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMPETENCE_RE = /^\d{4}-\d{2}$/;

function currentCompetence(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
}

/**
 * Relatorio em PDF ou CSV, gerado no servidor com o layout dos documentos:
 * /api/documents/reports/<tipo>?competencia=2026-10&formato=pdf|csv
 * (lista de presenca: &turma=<id>&aula=<id>). Pede sessao, `reports:view` e
 * `reports:export`; permissao do relatorio e plano sao conferidos pelo servico.
 */
export async function GET(request: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!(type in REPORT_FILE_SLUG)) {
    return Response.json({ message: "Relatório não encontrado." }, { status: 404 });
  }
  const url = new URL(request.url);
  const competence = url.searchParams.get("competencia") ?? "";
  const filter: ReportFilter = {
    competence: COMPETENCE_RE.test(competence) ? competence : currentCompetence(),
    classGroupId: url.searchParams.get("turma") || undefined,
    sessionId: url.searchParams.get("aula") || undefined,
  };
  try {
    const ctx = await requireTenant();
    ctx.require("reports:view");
    ctx.require("reports:export");
    const model = await buildReportDocument(ctx, type as ReportType, filter);
    if (!model) return Response.json({ message: "Relatório ainda sem documento." }, { status: 404 });
    return documentResponse(model, formatFromRequest(url), ctx.organizationId);
  } catch (error) {
    return documentErrorResponse(error);
  }
}
