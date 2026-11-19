import { NextRequest, NextResponse } from "next/server";
import { afterResponse } from "@/lib/after-response";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import { decodeSession } from "@/lib/session-cookie";
import { getAttachmentRecord } from "@/services/attachments/attachmentsBackend";
import { downloadAttachmentFromStorage } from "@/services/attachments/attachmentsStorage";
import { logError } from "@/lib/log";
import { isApiError } from "@gestarahub/contracts";
import { requireTenant } from "@/services/server/tenant";
import { attachmentIsUsed, removeAttachments } from "@/services/attachments/attachmentsCleanup";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

    // Arquivo de documento da ficha (atestado, laudo): so pela rota propria,
    // que confere quem pode ver (doc product/28).
    const { data: asDocument } = await createSupabaseAdminClient()
      .from("person_documents")
      .select("id")
      .eq("organization_id", session.organizationId)
      .eq("file->>id", id)
      .limit(1)
      .maybeSingle();
    if (asDocument) {
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

/**
 * Tirar o arquivo da lista antes de salvar o formulario (04/11/2026): apaga o
 * anexo se foi o proprio usuario que enviou e se nenhum registro o usa
 * (`attachment_is_used`, migracao 86). Comprovante ja salvo nunca sai por aqui.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireTenant();
    const admin = createSupabaseAdminClient();
    const { data: row } = await admin
      .from("attachments")
      .select("id, organization_id, storage_path, uploaded_by")
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    if (!row) return new Response(null, { status: 204 });
    if (row.uploaded_by !== ctx.userId) {
      return NextResponse.json({ message: "Só quem enviou pode tirar este arquivo." }, { status: 403 });
    }
    // Em uso: nao apaga. 200 (11/11/2026, antes 409): a limpeza do navegador
    // pede "tira se ninguem usa" de proposito e ignora a resposta; o 409 so
    // virava erro no console a cada formulario salvo com arquivo.
    // Conferir o uso e apagar no Storage depois da resposta (19/11/2026): o
    // navegador ignora a resposta. Em uso, fica; a rotina diaria limpa o resto.
    const organizationId = ctx.organizationId;
    await afterResponse("Tirar anexo não usado", async () => {
      if (await attachmentIsUsed(admin, organizationId, id)) return;
      await removeAttachments(admin, [
        { id: String(row.id), organization_id: String(row.organization_id), storage_path: String(row.storage_path) },
      ]);
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (isApiError(error)) return NextResponse.json({ message: error.message }, { status: error.httpStatus ?? 403 });
    logError("[DELETE /api/attachments/:id] Erro:", error);
    return NextResponse.json({ message: "Erro ao tirar o arquivo." }, { status: 500 });
  }
}
