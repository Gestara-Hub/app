import { renderClassCertificatesPdf } from "@/services/server/certificateDocument";
import { documentErrorResponse, pdfResponse } from "@/services/server/documents";
import { requireTenant } from "@/services/server/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Certificados de todos os concluidos da turma num PDF so (doc 21 §1.4):
 * /api/documents/certificates/class/<turma>. Pede `classes:view`; plano (Pro),
 * curso terminado e o recorte do professor sao conferidos pelo servico.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ classGroupId: string }> }) {
  const { classGroupId } = await params;
  try {
    const ctx = await requireTenant();
    ctx.require("classes:view");
    const { pdf, fileName } = await renderClassCertificatesPdf(ctx, classGroupId);
    return pdfResponse(pdf, fileName);
  } catch (error) {
    return documentErrorResponse(error);
  }
}
