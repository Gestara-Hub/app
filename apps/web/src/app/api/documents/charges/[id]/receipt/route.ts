import { documentErrorResponse, documentResponse, formatFromRequest } from "@/services/server/documents";
import { buildPaymentRecord } from "@/services/server/paymentDocuments";
import { requireTenant } from "@/services/server/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Recibo de uma cobranca paga: /api/documents/charges/<id>/receipt. Pede `billing:view`. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const ctx = await requireTenant();
    ctx.require("billing:view");
    const model = await buildPaymentRecord(ctx, id);
    return documentResponse(model, formatFromRequest(new URL(request.url)), ctx.organizationId);
  } catch (error) {
    return documentErrorResponse(error);
  }
}
