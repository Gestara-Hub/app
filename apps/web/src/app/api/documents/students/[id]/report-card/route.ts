import { documentErrorResponse, documentResponse, formatFromRequest } from "@/services/server/documents";
import { buildReportCard } from "@/services/server/studentDocuments";
import { requireTenant } from "@/services/server/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Boletim do aluno (trilha, notas e avancos): /api/documents/students/<id>/report-card. Pede `clients:view`. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const ctx = await requireTenant();
    ctx.require("clients:view");
    const model = await buildReportCard(ctx, id);
    return documentResponse(model, formatFromRequest(new URL(request.url)), ctx.organizationId);
  } catch (error) {
    return documentErrorResponse(error);
  }
}
