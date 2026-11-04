import { NextResponse } from "next/server";
import { isApiError } from "@gestarahub/contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { can } from "@/lib/permissions";
import { logError } from "@/lib/log";
import { requireTenant } from "@/services/server/tenant";
import { downloadAttachmentFromStorage } from "@/services/attachments/attachmentsStorage";

/** Tipos que abrem no navegador; o resto desce como arquivo (mesma regra dos anexos). */
const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]);

/**
 * Arquivo de um documento da ficha (doc product/28). Confere a sessao (com o
 * segundo fator) e as mesmas regras do servico: documento de aluno para quem
 * ve os alunos ou para o professor de uma turma dele; de instrutor, so para
 * proprietario e gerente. Atestado e laudo sao dado de saude: nada em cache
 * compartilhado.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireTenant();
    const admin = createSupabaseAdminClient();
    const { data: doc } = await admin
      .from("person_documents")
      .select("owner_kind, client_id, professional_id, file")
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    if (!doc) return NextResponse.json({ message: "Documento não encontrado." }, { status: 404 });

    let allowed = false;
    if (doc.owner_kind === "professional") {
      allowed = can(ctx.profile, "team:manage");
    } else if (can(ctx.profile, "clients:view")) {
      allowed = true;
    } else if (can(ctx.profile, "clients:view_own") && ctx.professionalId && doc.client_id) {
      const { data: classes } = await admin
        .from("class_groups")
        .select("id")
        .eq("organization_id", ctx.organizationId)
        .eq("instructor_id", ctx.professionalId);
      const classIds = (classes ?? []).map((c) => String(c.id));
      if (classIds.length > 0) {
        const { data: enrollment } = await admin
          .from("enrollments")
          .select("id")
          .eq("organization_id", ctx.organizationId)
          .eq("student_id", doc.client_id)
          .eq("status", "active")
          .in("class_group_id", classIds)
          .limit(1)
          .maybeSingle();
        allowed = Boolean(enrollment);
      }
    }
    if (!allowed) return NextResponse.json({ message: "Você não pode abrir este documento." }, { status: 403 });

    const fileId = String((doc.file as { id?: string } | null)?.id ?? "");
    const { data: record } = await admin
      .from("attachments")
      .select("name, content_type, storage_path")
      .eq("id", fileId)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    const storagePath = record ? String(record.storage_path) : "";
    if (!record || !storagePath.startsWith(`${ctx.organizationId}/`)) {
      return NextResponse.json({ message: "Arquivo não encontrado." }, { status: 404 });
    }
    const downloaded = await downloadAttachmentFromStorage(storagePath);
    if (!downloaded) return NextResponse.json({ message: "Arquivo não encontrado." }, { status: 404 });

    const declared = String(record.content_type ?? "").split(";")[0].trim().toLowerCase();
    const inline = INLINE_TYPES.has(declared);
    const headers = new Headers();
    headers.set("Content-Type", inline ? declared : "application/octet-stream");
    headers.set("Content-Length", String(downloaded.blob.size));
    headers.set(
      "Content-Disposition",
      `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(String(record.name))}"`,
    );
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Cache-Control", "private, no-store");
    return new Response(downloaded.blob, { status: 200, headers });
  } catch (error) {
    if (isApiError(error)) {
      const status = error.httpStatus ?? 403;
      return NextResponse.json({ message: error.message }, { status });
    }
    logError("[GET /api/person-documents/:id] Erro:", error);
    return NextResponse.json({ message: "Erro ao carregar o documento." }, { status: 500 });
  }
}
