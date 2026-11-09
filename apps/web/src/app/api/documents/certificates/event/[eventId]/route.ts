import { renderEventCertificatesPdf } from "@/services/server/certificateDocument";
import { documentErrorResponse, pdfResponse } from "@/services/server/documents";
import { requireTenant } from "@/services/server/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Certificados de participacao de todos os presentes do evento num PDF so
 * (doc product/29): /api/documents/certificates/event/<evento>. Pede
 * `events:view`; plano (Pro), evento terminado e o recorte do professor sao
 * conferidos pelo servico.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  try {
    const ctx = await requireTenant();
    ctx.require("events:view");
    const { pdf, fileName } = await renderEventCertificatesPdf(ctx, eventId);
    return pdfResponse(pdf, fileName);
  } catch (error) {
    return documentErrorResponse(error);
  }
}
