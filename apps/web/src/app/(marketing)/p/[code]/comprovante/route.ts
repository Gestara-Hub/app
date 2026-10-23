import { paymentReceiptDocument } from "@/lib/documents/payment-receipt";
import { documentErrorResponse, documentResponse } from "@/services/server/documents";
import { loadPaymentPage } from "@/services/server/paymentPage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Comprovante em PDF do pagamento online (/p/<codigo>/comprovante), gerado no
 * servidor com o layout dos documentos. Publico como a pagina: so dados do
 * pagamento e do espaco. Ainda nao pago ou codigo desconhecido: volta a pagina.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    const view = await loadPaymentPage(code);
    if (!view || view.state !== "paid") {
      return Response.redirect(new URL(`/p/${encodeURIComponent(code)}`, request.url), 303);
    }
    const model = paymentReceiptDocument({
      code: view.code,
      organizationName: view.organizationName,
      label: view.label,
      amountCents: view.amountCents,
      paidAt: view.paid?.paidAt,
      methodLabel: view.paid?.methodLabel ?? "Pagamento online",
      competenceLabel: view.paid?.competenceLabel,
      breakdown: view.paid?.breakdown,
      issuedAt: new Date().toISOString(),
    });
    return documentResponse(model, "pdf", view.organizationId);
  } catch (error) {
    return documentErrorResponse(error);
  }
}
