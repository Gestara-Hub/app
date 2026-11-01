import type { SaveCertificateTemplate } from "@gestarahub/contracts";
import { renderCertificatePreviewPdf } from "@/services/server/certificateDocument";
import { documentErrorResponse, pdfResponse } from "@/services/server/documents";
import { requireTenant } from "@/services/server/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Previa em PDF do modelo em edicao (Configuracoes -> Certificado, "Ver em PDF"):
 * recebe o modelo no corpo e devolve o PDF com os dados de exemplo. Nao grava.
 * Pede quem gere turmas (quem edita o modelo); o plano e conferido no servico.
 */
export async function POST(request: Request) {
  try {
    const ctx = await requireTenant();
    ctx.require("classes:manage");
    const body = (await request.json().catch(() => null)) as
      | { template?: SaveCertificateTemplate; kind?: unknown; enrollmentId?: unknown; studentId?: unknown; promotionId?: unknown }
      | null;
    if (!body?.template || typeof body.template !== "object") {
      return Response.json({ message: "Modelo ausente." }, { status: 400 });
    }
    const str = (value: unknown) => (typeof value === "string" && value ? value : undefined);
    const { pdf, fileName } = await renderCertificatePreviewPdf(ctx, body.template, {
      kind: body.kind === "graduation" ? "graduation" : "course",
      enrollmentId: str(body.enrollmentId),
      studentId: str(body.studentId),
      promotionId: str(body.promotionId),
    });
    return pdfResponse(pdf, fileName);
  } catch (error) {
    return documentErrorResponse(error);
  }
}
