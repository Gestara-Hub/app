import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";

/**
 * Leitura do arquivo no storage pela chave de servico, so para a rota de anexos
 * (que confere o registro pela sessao antes). Sem "use server" de proposito:
 * como action, qualquer um baixaria um arquivo pelo caminho.
 */
export async function downloadAttachmentFromStorage(
  storagePath: string,
): Promise<{ blob: Blob; contentType?: string } | null> {
  const client = createSupabaseAdminClient();
  const { data, error } = await client.storage.from("attachments").download(storagePath);
  if (error || !data) {
    logError("[attachmentsBackend] Erro ao baixar arquivo do storage:", error);
    return null;
  }
  return { blob: data, contentType: data.type };
}
