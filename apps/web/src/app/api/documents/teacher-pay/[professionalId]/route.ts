import { documentErrorResponse, documentResponse, formatFromRequest } from "@/services/server/documents";
import { buildTeacherStatement } from "@/services/server/paymentDocuments";
import { requireTenant } from "@/services/server/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMPETENCE_RE = /^\d{4}-\d{2}$/;

/**
 * Demonstrativo do pagamento do professor no mes:
 * /api/documents/teacher-pay/<professionalId>?competencia=2026-10. Pede `finance:view`.
 */
export async function GET(request: Request, { params }: { params: Promise<{ professionalId: string }> }) {
  const { professionalId } = await params;
  const url = new URL(request.url);
  const competence = url.searchParams.get("competencia") ?? "";
  if (!COMPETENCE_RE.test(competence)) {
    return Response.json({ message: "Informe o mês do pagamento." }, { status: 400 });
  }
  try {
    const ctx = await requireTenant();
    ctx.require("finance:view");
    const model = await buildTeacherStatement(ctx, professionalId, competence);
    return documentResponse(model, formatFromRequest(url), ctx.organizationId);
  } catch (error) {
    return documentErrorResponse(error);
  }
}
