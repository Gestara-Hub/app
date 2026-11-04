import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import { decodeSession } from "@/lib/session-cookie";
import { saveAttachmentInStorage } from "@/services/attachments/attachmentsBackend";
import { isApiError, type FileAttachment } from "@gestarahub/contracts";
import { logError } from "@/lib/log";
import { MAX_UPLOAD_BYTES, formatBytes } from "@/lib/files";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const rawSession = cookieStore.get(SESSION_COOKIE)?.value;
    const session = decodeSession(rawSession);

    if (!session?.organizationId) {
      return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
    }

    // Um arquivo por requisicao, ate 4 MB (o navegador ja manda assim). Corpo
    // maior que isso nem e lido.
    const tooBig = () =>
      NextResponse.json(
        { message: `Arquivo maior que ${formatBytes(MAX_UPLOAD_BYTES)}. Envie um arquivo menor.` },
        { status: 413 },
      );
    const declaredLength = Number(req.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_UPLOAD_BYTES + 64 * 1024) return tooBig();

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ message: "Nenhum arquivo enviado." }, { status: 400 });
    }
    if (files.length > 1) {
      return NextResponse.json({ message: "Envie um arquivo por vez." }, { status: 400 });
    }
    if (files.some((file) => file.size > MAX_UPLOAD_BYTES)) return tooBig();

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
    // Sem permissao ou sessao vencida: resposta do proprio erro, sem registrar falha.
    if (isApiError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.httpStatus ?? 400 });
    }
    logError("[POST /api/attachments] Erro no upload:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro interno no upload." },
      { status: 500 },
    );
  }
}
