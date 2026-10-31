import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import type { ApiError, DocumentModel } from "@gestarahub/contracts";
import { isApiError } from "@gestarahub/contracts";
import { DocumentPdf, type DocumentLogo } from "@/lib/documents/document-pdf";
import { documentToCsv } from "@/lib/documents/csv";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";

/**
 * Documentos no servidor (PDF com @react-pdf e CSV) a partir do mesmo
 * `DocumentModel` da previa na tela. Modulo so do servidor, sem "use server".
 */

export type DocumentFormat = "pdf" | "csv";

/** Formatos que o @react-pdf aceita na imagem. */
const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/jpg"]);

let fallbackLogo: DocumentLogo | null | undefined;

/** Logo do GestaraHub (public/documents): reserva de todo documento. */
async function gestaraHubLogo(): Promise<DocumentLogo | null> {
  if (fallbackLogo !== undefined) return fallbackLogo;
  try {
    const buffer = await readFile(path.join(process.cwd(), "public", "documents", "gestarahub-logo.png"));
    fallbackLogo = { src: `data:image/png;base64,${buffer.toString("base64")}` };
  } catch {
    fallbackLogo = null;
  }
  return fallbackLogo;
}

/**
 * Logo do espaco (a do modelo de certificado, unica cadastrada hoje), ou null
 * sem ela ou em formato que o PDF nao le. Le com a chave de servico, sempre
 * filtrando pelo espaco.
 */
export async function loadSpaceLogo(organizationId: string): Promise<DocumentLogo | null> {
  try {
    const admin = createSupabaseAdminClient();
    const { data: org } = await admin
      .from("organizations")
      .select("certificate_template")
      .eq("id", organizationId)
      .maybeSingle();
    const fileId = (org?.certificate_template as { logoFileId?: string } | null)?.logoFileId;
    return fileId ? await loadSpaceImage(organizationId, fileId) : null;
  } catch (error) {
    logError("[documents] Erro ao carregar a logo do espaço:", error);
    return null;
  }
}

/**
 * Imagem guardada nos anexos do espaco (logo, arte do certificado), em data URL
 * para o PDF. So PNG e JPG, e so da pasta do proprio espaco (revisao geral de
 * 31/10/2026, achado S5).
 */
export async function loadSpaceImage(organizationId: string, fileId: string): Promise<DocumentLogo | null> {
  try {
    const admin = createSupabaseAdminClient();
    const { data: file } = await admin
      .from("attachments")
      .select("storage_path, content_type")
      .eq("id", fileId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    const type = String(file?.content_type ?? "").toLowerCase();
    if (!file?.storage_path || !String(file.storage_path).startsWith(`${organizationId}/`) || !LOGO_TYPES.has(type)) {
      return null;
    }
    const { data: blob } = await admin.storage.from("attachments").download(String(file.storage_path));
    if (!blob) return null;
    const buffer = Buffer.from(await blob.arrayBuffer());
    return { src: `data:${type === "image/jpg" ? "image/jpeg" : type};base64,${buffer.toString("base64")}` };
  } catch (error) {
    logError("[documents] Erro ao carregar a imagem do espaço:", error);
    return null;
  }
}

/** Logo dos documentos: a do espaco; sem ela, a do GestaraHub. */
export async function loadDocumentLogo(organizationId?: string): Promise<DocumentLogo | null> {
  return (organizationId ? await loadSpaceLogo(organizationId) : null) ?? gestaraHubLogo();
}

export async function renderDocumentPdf(model: DocumentModel, organizationId?: string): Promise<Buffer> {
  const logo = await loadDocumentLogo(organizationId);
  return renderToBuffer(<DocumentPdf model={model} logo={logo} />);
}

/** PDF pronto (abre no navegador). */
export function pdfResponse(pdf: Buffer, fileName: string): Response {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Resposta de download: PDF (abre no navegador) ou CSV (baixa). */
export async function documentResponse(
  model: DocumentModel,
  format: DocumentFormat,
  organizationId?: string,
): Promise<Response> {
  if (format === "csv") {
    return new Response(documentToCsv(model), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${model.fileName}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  return pdfResponse(await renderDocumentPdf(model, organizationId), model.fileName);
}

/** Erro da regra (sem permissao, fora do plano, sem sessao) vira JSON com o status certo. */
export function documentErrorResponse(error: unknown): Response {
  if (isApiError(error)) {
    const apiError = error as ApiError;
    return Response.json(
      { message: apiError.message, code: apiError.code },
      { status: apiError.httpStatus ?? (apiError.code === "NOT_FOUND" ? 404 : 400) },
    );
  }
  logError("[documents] Erro ao gerar documento:", error);
  return Response.json({ message: "Não foi possível gerar o documento." }, { status: 500 });
}

/** "pdf" (padrao) ou "csv" pelo `?formato=`. */
export function formatFromRequest(url: URL): DocumentFormat {
  return url.searchParams.get("formato") === "csv" ? "csv" : "pdf";
}
