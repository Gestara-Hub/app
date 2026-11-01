import { renderGraduationCertificatePdf } from "@/services/server/certificateDocument";
import { documentErrorResponse, pdfResponse } from "@/services/server/documents";
import { requireTenant } from "@/services/server/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Certificado de graduacao em PDF (doc 21 §1.6):
 * /api/documents/certificates/graduation/<aluno>/<graduacao>. Pede quem ve
 * alunos; emitir (progression:manage) e o plano sao conferidos pelo servico.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ studentId: string; promotionId: string }> }) {
  const { studentId, promotionId } = await params;
  try {
    const ctx = await requireTenant();
    ctx.require("clients:view", "clients:view_own");
    const { pdf, fileName } = await renderGraduationCertificatePdf(ctx, studentId, promotionId);
    return pdfResponse(pdf, fileName);
  } catch (error) {
    return documentErrorResponse(error);
  }
}
