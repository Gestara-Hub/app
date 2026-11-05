import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";
import { attachmentIsUsed, removeAttachments } from "@/services/attachments/attachmentsCleanup";
import { setDocumentFileRemover } from "./personDocumentRules";

/**
 * Apaga do armazenamento o arquivo de um documento tirado da ficha, depois da
 * gravacao (doc product/28). So do servidor e sem "use server": nao vira
 * action que o navegador chame. Confere no banco que nenhum registro usa mais
 * o arquivo (`attachment_is_used`, migracao 86) e que ele e do proprio espaco.
 */
export async function removeDocumentFiles(organizationId: string, fileIds: string[]): Promise<void> {
  const ids = [...new Set(fileIds.filter(Boolean))];
  if (ids.length === 0) return;
  const admin = createSupabaseAdminClient();
  const unused: string[] = [];
  for (const id of ids) if (!(await attachmentIsUsed(admin, organizationId, id))) unused.push(id);
  if (unused.length === 0) return;
  const { data: records, error } = await admin
    .from("attachments")
    .select("id, organization_id, storage_path")
    .eq("organization_id", organizationId)
    .in("id", unused);
  if (error) {
    logError("[personDocuments] Erro ao ler os anexos do documento:", error);
    return;
  }
  await removeAttachments(
    admin,
    (records ?? []).map((r) => ({ id: String(r.id), organization_id: String(r.organization_id), storage_path: String(r.storage_path) })),
  );
}

setDocumentFileRemover(removeDocumentFiles);
