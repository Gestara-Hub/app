import { renderEventCertificatePdf } from "@/services/server/certificateDocument";
import { documentErrorResponse, pdfResponse } from "@/services/server/documents";
import { requireTenant } from "@/services/server/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Certificado de participacao de um inscrito em PDF (doc product/29): emite na 1a vez. */
export async function GET(_request: Request, { params }: { params: Promise<{ registrationId: string }> }) {
  const { registrationId } = await params;
  try {
    const ctx = await requireTenant();
    ctx.require("events:view");
    const { pdf, fileName } = await renderEventCertificatePdf(ctx, registrationId);
    return pdfResponse(pdf, fileName);
  } catch (error) {
    return documentErrorResponse(error);
  }
}
