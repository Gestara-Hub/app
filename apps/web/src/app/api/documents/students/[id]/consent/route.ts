import { documentErrorResponse, documentResponse } from "@/services/server/documents";
import { buildMinorConsent } from "@/services/server/studentDocuments";
import { requireTenant } from "@/services/server/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Termo de autorizacao do responsavel (aluno menor): /api/documents/students/<id>/consent. Pede `clients:view`. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const ctx = await requireTenant();
    ctx.require("clients:view");
    const model = await buildMinorConsent(ctx, id);
    return documentResponse(model, "pdf", ctx.organizationId);
  } catch (error) {
    return documentErrorResponse(error);
  }
}
