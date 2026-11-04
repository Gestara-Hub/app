import type { FileAttachment, Id } from "@gestarahub/contracts";
import { MAX_UPLOAD_BYTES, RECEIPT_FILE_RULES, fileIssue, formatBytes, type FileRules } from "@/lib/files";
import { realAccountInBrowser } from "../world/delegate";
import { getFileBlob, putFileBlob } from "@/mocks/file-blobs";
import { newId, nowIso, writeOp, validationError } from "@/services/world/ops";
import { logError } from "@/lib/log";

/**
 * Envio e leitura de anexos (comprovantes, notas, boletos, logos).
 * No tenant Supabase: envia via HTTP multipart para /api/attachments (Supabase Storage bucket 'attachments')
 * e serve via endpoint autenticado /api/attachments/[id].
 * No tenant mock: guarda no IndexedDB do navegador (mocks/file-blobs.ts).
 */
export const attachmentsService = {
  async upload(
    files: File[],
    rules: FileRules = RECEIPT_FILE_RULES,
    field = "receipts",
  ): Promise<FileAttachment[]> {
    const invalid = files.find((file) => fileIssue(file, rules));
    if (invalid) {
      throw validationError([{ field, message: `“${invalid.name}”: ${fileIssue(invalid, rules)}` }]);
    }

    if (typeof window !== "undefined" && realAccountInBrowser()) {
      // Um arquivo por requisicao (04/11/2026): cada um cabe no limite de corpo
      // da Vercel (4,5 MB) e o erro aponta o arquivo certo. Conta real nao cai
      // no armazenamento do navegador: o erro aparece no campo.
      const attachments: FileAttachment[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("files", file);
        let res: Response;
        try {
          res = await fetch("/api/attachments", { method: "POST", body: formData });
        } catch (err) {
          logError("[attachmentsService] Falha de rede no envio:", err);
          throw validationError([{ field, message: `“${file.name}”: não foi possível enviar. Confira a internet e tente de novo.` }]);
        }
        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as { message?: string };
          const reason =
            res.status === 413
              ? `maior que ${formatBytes(MAX_UPLOAD_BYTES)}.`
              : errData.message || "não foi possível enviar.";
          if (res.status >= 500) logError("[attachmentsService] Erro no envio do arquivo:", errData.message ?? res.status);
          throw validationError([{ field, message: `“${file.name}”: ${reason}` }]);
        }
        const data = (await res.json()) as { attachments: FileAttachment[] };
        const [saved] = data.attachments;
        // Copia local no navegador por conveniencia (abrir sem baixar de novo).
        await putFileBlob(saved.id, file).catch(() => {});
        attachments.push(saved);
      }
      return attachments;
    }

    const uploadedAt = nowIso();
    const attachments = files.map<FileAttachment>((file) => ({
      id: newId(),
      name: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      uploadedAt,
    }));
    await Promise.all(attachments.map((a, i) => putFileBlob(a.id, files[i])));
    return writeOp(() => attachments);
  },

  /**
   * Endereço para abrir ou exibir o arquivo.
   * No Supabase, retorna o endpoint autenticado /api/attachments/[id].
   * No mock, retorna o object URL temporário do IndexedDB.
   */
  async openUrl(id: Id): Promise<string | null> {
    if (realAccountInBrowser()) {
      return `/api/attachments/${id}`;
    }
    const blob = await getFileBlob(id);
    return blob ? URL.createObjectURL(blob) : null;
  },
};
