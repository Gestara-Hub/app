import { loadDocumentLogo } from "@/services/server/documents";
import { requireTenant } from "@/services/server/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Logo dos documentos para a previa na tela: a do espaco ou, sem ela, a do
 * GestaraHub (a mesma regra do PDF). Sem sessao, a do GestaraHub.
 */
export async function GET(request: Request) {
  try {
    const ctx = await requireTenant();
    const logo = await loadDocumentLogo(ctx.organizationId);
    const match = logo ? /^data:([^;]+);base64,(.+)$/.exec(logo.src) : null;
    if (match) {
      return new Response(new Uint8Array(Buffer.from(match[2], "base64")), {
        headers: { "Content-Type": match[1], "Cache-Control": "private, max-age=300" },
      });
    }
  } catch {
    // Sem sessao: cai na logo do GestaraHub.
  }
  return Response.redirect(new URL("/documents/gestarahub-logo.png", request.url), 302);
}
