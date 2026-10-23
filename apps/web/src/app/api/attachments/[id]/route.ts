import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, decodeSession } from "@/lib/session";
import { getAttachmentRecord } from "@/services/attachments/attachmentsBackend";
import { downloadAttachmentFromStorage } from "@/services/attachments/attachmentsStorage";

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
    if (!record) {
      return NextResponse.json({ message: "Anexo não encontrado." }, { status: 404 });
    }

    const downloaded = await downloadAttachmentFromStorage(record.storagePath);
    if (!downloaded) {
      return NextResponse.json({ message: "Arquivo não encontrado no storage." }, { status: 404 });
    }

    const headers = new Headers();
    headers.set("Content-Type", record.contentType || "application/octet-stream");
    headers.set("Content-Length", String(record.sizeBytes));
    headers.set(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(record.name)}"`,
    );
    headers.set("Cache-Control", "private, max-age=3600");

    return new Response(downloaded.blob, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("[GET /api/attachments/:id] Erro:", error);
    return NextResponse.json(
      { message: "Erro ao carregar arquivo." },
      { status: 500 },
    );
  }
}
