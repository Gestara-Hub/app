import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import { decodeSession } from "@/lib/session-cookie";
import { saveAttachmentInStorage } from "@/services/attachments/attachmentsBackend";
import type { FileAttachment } from "@gestarahub/contracts";
import { logError } from "@/lib/log";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const rawSession = cookieStore.get(SESSION_COOKIE)?.value;
    const session = decodeSession(rawSession);

    if (!session?.organizationId) {
      return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
    }

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ message: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const results: FileAttachment[] = [];

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const attachment = await saveAttachmentInStorage(
        {
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          buffer,
        },
        session.organizationId,
      );

      results.push(attachment);
    }

    return NextResponse.json({ attachments: results });
  } catch (error) {
    logError("[POST /api/attachments] Erro no upload:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro interno no upload." },
      { status: 500 },
    );
  }
}
