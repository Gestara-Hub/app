import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/log";

/**
 * Anexo sem uso (04/11/2026, migracao 86): o arquivo sobe ao ser escolhido,
 * antes de salvar; "em uso" e o que algum registro aponta, conferido no banco
 * (`attachment_is_used`). Modulo so do servidor, sem "use server": nao vira
 * action.
 */

/** O anexo esta em uso? Na duvida (erro de leitura), trata como em uso. */
export async function attachmentIsUsed(admin: SupabaseClient, organizationId: string, id: string): Promise<boolean> {
  const { data, error } = await admin.rpc("attachment_is_used", { p_org: organizationId, p_id: id });
  if (error) {
    logError("[attachments] Erro ao conferir se o anexo esta em uso:", error);
    return true;
  }
  return data === true;
}

/** Apaga arquivo e linha de anexos do espaco (o chamador ja conferiu que estao sem uso). */
export async function removeAttachments(
  admin: SupabaseClient,
  rows: { id: string; organization_id: string; storage_path: string }[],
): Promise<number> {
  const own = rows.filter((r) => r.storage_path.startsWith(`${r.organization_id}/`));
  if (own.length === 0) return 0;
  const { error } = await admin.storage.from("attachments").remove(own.map((r) => r.storage_path));
  if (error) {
    logError("[attachments] Erro ao apagar arquivos do armazenamento:", error);
    return 0;
  }
  const { error: deleteError } = await admin
    .from("attachments")
    .delete()
    .in(
      "id",
      own.map((r) => r.id),
    );
  if (deleteError) logError("[attachments] Arquivos apagados, mas os registros ficaram:", deleteError);
  return own.length;
}

/**
 * Rotina diaria: apaga os anexos sem uso enviados ha mais de 24 horas
 * (formulario cancelado, aba fechada, pagamento desfeito). A conferencia de uso
 * e feita de novo no banco na hora; um anexo usado nunca entra.
 */
export async function cleanupUnusedAttachments(admin: SupabaseClient): Promise<{ removed: number }> {
  let removed = 0;
  for (let round = 0; round < 10; round += 1) {
    const { data, error } = await admin.rpc("unused_attachments", { p_older_than: "24 hours", p_limit: 200 });
    if (error) throw error;
    const rows = (data ?? []) as { id: string; organization_id: string; storage_path: string }[];
    if (rows.length === 0) break;
    const count = await removeAttachments(admin, rows);
    removed += count;
    if (count < rows.length) break;
  }
  return { removed };
}
