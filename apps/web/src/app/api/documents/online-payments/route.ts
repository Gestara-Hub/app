import { documentErrorResponse, documentResponse, formatFromRequest } from "@/services/server/documents";
import { buildOnlineStatement } from "@/services/server/studentDocuments";
import { requireTenant } from "@/services/server/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMPETENCE_RE = /^\d{4}-\d{2}$/;

/**
 * Extrato da conta de recebimento no mes:
 * /api/documents/online-payments?competencia=2026-10&formato=pdf|csv. Pede `finance:view`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const competence = url.searchParams.get("competencia") ?? "";
  if (!COMPETENCE_RE.test(competence)) {
    return Response.json({ message: "Informe o mês do extrato." }, { status: 400 });
  }
  try {
    const ctx = await requireTenant();
    ctx.require("finance:view");
    const model = await buildOnlineStatement(ctx, competence);
    return documentResponse(model, formatFromRequest(url), ctx.organizationId);
  } catch (error) {
    return documentErrorResponse(error);
  }
}
