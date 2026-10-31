"use server";

import type { FileAttachment, Id } from "@gestarahub/contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getClientForTenant } from "@/lib/supabase/tenant-client";
import { logError } from "@/lib/log";
import { requireSameOrganization } from "../server/tenant";

/** Quem anexa arquivos (o mesmo que o banco aceitava antes da migracao 78). */
const UPLOADERS = ["owner", "manager", "attendant"] as const;

export interface AttachmentRecord {
  id: Id;
  organizationId: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
  uploadedAt: string;
}

export async function saveAttachmentInStorage(
  file: {
    name: string;
    type: string;
    size: number;
    buffer: Buffer;
  },
  organizationId: string,
): Promise<FileAttachment> {
  // Espaco e perfil da sessao no banco; a linha do anexo e gravada pelo servidor,
  // porque o banco nao aceita escrita direta do usuario (migracao 78).
  const ctx = await requireSameOrganization(organizationId, { profiles: [...UPLOADERS] });
  const client = ctx.client;
  const id = crypto.randomUUID();
  const safeFilename = encodeURIComponent(file.name.replace(/[^a-zA-Z0-9._-]/g, "_"));
  const storagePath = `${ctx.organizationId}/${id}/${safeFilename}`;
  const uploadedAt = new Date().toISOString();

  // 1. Upload to Supabase Storage bucket 'attachments'
  const { error: uploadError } = await client.storage
    .from("attachments")
    .upload(storagePath, file.buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });

  if (uploadError) {
    logError("[attachmentsBackend] Erro ao fazer upload no Supabase Storage:", uploadError);
    throw new Error(`Falha no upload do arquivo para o storage: ${uploadError.message}`);
  }

  // 2. Persist metadata in public.attachments
  const { error: dbError } = await createSupabaseAdminClient().from("attachments").insert({
    id,
    organization_id: ctx.organizationId,
    name: file.name,
    content_type: file.type || "application/octet-stream",
    size_bytes: file.size,
    storage_path: storagePath,
    uploaded_at: uploadedAt,
  });

  if (dbError) {
    logError("[attachmentsBackend] Erro ao salvar metadados do anexo:", dbError);
    // Cleanup orphaned storage object
    await client.storage.from("attachments").remove([storagePath]);
    throw new Error("Falha ao registrar metadados do anexo no banco de dados.");
  }

  return {
    id,
    name: file.name,
    contentType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    uploadedAt,
  };
}

export async function getAttachmentRecord(
  id: Id,
  organizationId?: string,
): Promise<AttachmentRecord | null> {
  const client = await getClientForTenant();
  let query = client.from("attachments").select("*").eq("id", id);
  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    return null;
  }

  return {
    id: String(data.id),
    organizationId: String(data.organization_id),
    name: String(data.name),
    contentType: String(data.content_type),
    sizeBytes: Number(data.size_bytes),
    storagePath: String(data.storage_path),
    uploadedAt: new Date(String(data.uploaded_at)).toISOString(),
  };
}
