import { renderCertificatePdf } from "@/services/server/certificateDocument";
import { documentErrorResponse, pdfResponse } from "@/services/server/documents";
import { requireTenant } from "@/services/server/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Certificado de conclusao em PDF: /api/documents/certificates/<matricula>.
 * Pede `classes:view`; plano (Pro) e curso terminado sao conferidos pelo servico.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params;
  try {
    const ctx = await requireTenant();
    ctx.require("classes:view");
    const { pdf, fileName } = await renderCertificatePdf(ctx, enrollmentId);
    return pdfResponse(pdf, fileName);
  } catch (error) {
    return documentErrorResponse(error);
  }
}
