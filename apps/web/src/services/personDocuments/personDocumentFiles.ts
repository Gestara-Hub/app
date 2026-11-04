import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";
import { setDocumentFileRemover } from "./personDocumentRules";

/**
 * Apaga do armazenamento o arquivo de um documento tirado da ficha, depois da
 * gravacao (doc product/28). So do servidor e sem "use server": nao vira
 * action que o navegador chame. Confere que nenhum documento usa mais o
 * arquivo e que ele e da pasta do proprio espaco.
 */
export async function removeDocumentFiles(organizationId: string, fileIds: string[]): Promise<void> {
  const ids = [...new Set(fileIds.filter(Boolean))];
  if (ids.length === 0) return;
  const admin = createSupabaseAdminClient();
  const { data: stillUsed, error: usedError } = await admin
    .from("person_documents")
    .select("file")
    .eq("organization_id", organizationId)
    .in("file->>id", ids);
  if (usedError) {
    logError("[personDocuments] Erro ao conferir os arquivos em uso:", usedError);
    return;
  }
  const used = new Set((stillUsed ?? []).map((row) => String((row.file as { id?: string } | null)?.id ?? "")));
  const orphan = ids.filter((id) => !used.has(id));
  if (orphan.length === 0) return;

  const { data: records, error } = await admin
    .from("attachments")
    .select("id, storage_path")
    .eq("organization_id", organizationId)
    .in("id", orphan);
  if (error) {
    logError("[personDocuments] Erro ao ler os anexos do documento:", error);
    return;
  }
  const own = (records ?? []).filter((r) => String(r.storage_path).startsWith(`${organizationId}/`));
  if (own.length === 0) return;
  const { error: removeError } = await admin.storage.from("attachments").remove(own.map((r) => String(r.storage_path)));
  if (removeError) {
    logError("[personDocuments] Erro ao apagar o arquivo do armazenamento:", removeError);
    return;
  }
  const { error: deleteError } = await admin
    .from("attachments")
    .delete()
    .eq("organization_id", organizationId)
    .in(
      "id",
      own.map((r) => String(r.id)),
    );
  if (deleteError) logError("[personDocuments] Arquivo apagado, mas o registro do anexo ficou:", deleteError);
}

setDocumentFileRemover(removeDocumentFiles);
