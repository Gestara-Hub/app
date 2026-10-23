import { documentErrorResponse, documentResponse, formatFromRequest } from "@/services/server/documents";
import { buildPaymentsStatement } from "@/services/server/paymentDocuments";
import { requireTenant } from "@/services/server/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Declaracao anual de pagamentos do aluno:
 * /api/documents/students/<id>/payments?ano=2026. Pede `billing:view`.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("ano"));
  const thisYear = Number(new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 4));
  try {
    const ctx = await requireTenant();
    ctx.require("billing:view");
    const model = await buildPaymentsStatement(ctx, id, Number.isInteger(year) && year >= 2000 && year <= thisYear ? year : thisYear);
    return documentResponse(model, formatFromRequest(url), ctx.organizationId);
  } catch (error) {
    return documentErrorResponse(error);
  }
}
