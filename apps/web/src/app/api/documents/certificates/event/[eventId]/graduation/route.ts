import { renderEventGraduationCertificatesPdf } from "@/services/server/certificateDocument";
import { documentErrorResponse, pdfResponse } from "@/services/server/documents";
import { requireTenant } from "@/services/server/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Certificados de graduacao de quem graduou no evento, num PDF so (doc
 * product/30 §4): /api/documents/certificates/event/<evento>/graduation. Pede
 * quem ve alunos; emitir (progression:manage, professor so os dele) e o plano
 * sao conferidos pelo servico.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  try {
    const ctx = await requireTenant();
    ctx.require("clients:view", "clients:view_own");
    const { pdf, fileName } = await renderEventGraduationCertificatesPdf(ctx, eventId);
    return pdfResponse(pdf, fileName);
  } catch (error) {
    return documentErrorResponse(error);
  }
}
