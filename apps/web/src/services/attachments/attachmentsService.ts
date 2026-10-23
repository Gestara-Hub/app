import type { FileAttachment, Id } from "@gestarahub/contracts";
import { RECEIPT_FILE_RULES, fileIssue, type FileRules } from "@/lib/files";
import { realAccountInBrowser } from "../world/delegate";
import { getFileBlob, putFileBlob } from "@/mocks/file-blobs";
import { newId, nowIso, writeOp, validationError } from "@/services/world/ops";

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
      try {
        const formData = new FormData();
        for (const file of files) {
          formData.append("files", file);
        }

        const res = await fetch("/api/attachments", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Falha no upload para o storage.");
        }

        const data = (await res.json()) as { attachments: FileAttachment[] };
        // Cache local no IndexedDB por conveniência
        await Promise.all(
          data.attachments.map((a, i) => putFileBlob(a.id, files[i]).catch(() => {})),
        );
        return data.attachments;
      } catch (err) {
        console.error("[attachmentsService] Erro no upload via storage, caindo no fallback local:", err);
      }
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
