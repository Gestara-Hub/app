import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import { decodeSession } from "@/lib/session-cookie";
import { getAttachmentRecord } from "@/services/attachments/attachmentsBackend";
import { downloadAttachmentFromStorage } from "@/services/attachments/attachmentsStorage";
import { logError } from "@/lib/log";

/**
 * Tipos que abrem no navegador. O resto (e qualquer tipo que a linha diga)
 * desce como arquivo: um HTML gravado como anexo nao roda script na origem do
 * app (revisao geral de 31/10/2026, achado S5). SVG fica de fora: pode ter script.
 */
const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const rawSession = cookieStore.get(SESSION_COOKIE)?.value;
    const session = decodeSession(rawSession);

    if (!session?.organizationId) {
      return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
    }

    const record = await getAttachmentRecord(id, session.organizationId);
    // O arquivo precisa estar na pasta do proprio espaco (a linha nao escolhe outro caminho).
    if (!record || !record.storagePath.startsWith(`${session.organizationId}/`)) {
      return NextResponse.json({ message: "Anexo não encontrado." }, { status: 404 });
    }

    const downloaded = await downloadAttachmentFromStorage(record.storagePath);
    if (!downloaded) {
      return NextResponse.json({ message: "Arquivo não encontrado no storage." }, { status: 404 });
    }

    const declared = (record.contentType || "").split(";")[0].trim().toLowerCase();
    const inline = INLINE_TYPES.has(declared);
    const headers = new Headers();
    headers.set("Content-Type", inline ? declared : "application/octet-stream");
    headers.set("Content-Length", String(downloaded.blob.size));
    headers.set(
      "Content-Disposition",
      `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(record.name)}"`,
    );
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Cache-Control", "private, max-age=3600");

    return new Response(downloaded.blob, {
      status: 200,
      headers,
    });
  } catch (error) {
    logError("[GET /api/attachments/:id] Erro:", error);
    return NextResponse.json(
      { message: "Erro ao carregar arquivo." },
      { status: 500 },
    );
  }
}
