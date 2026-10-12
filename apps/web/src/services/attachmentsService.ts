import type { FileAttachment, Id } from "@gestarahub/contracts";
import { RECEIPT_FILE_RULES, fileIssue, type FileRules } from "@/lib/files";
import { getFileBlob, putFileBlob } from "@/mocks/file-blobs";
import { newId, nowIso, simulateWrite, validationError } from "@/mocks/helpers";

/**
 * Envio e leitura de anexos (comprovantes, notas, boletos). O envio devolve os
 * metadados que o registro guarda (`FileAttachment`); o conteudo fica no
 * armazenamento de arquivos. Imita o futuro `POST /attachments`.
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
    const uploadedAt = nowIso();
    const attachments = files.map<FileAttachment>((file) => ({
      id: newId(),
      name: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      uploadedAt,
    }));
    await Promise.all(attachments.map((a, i) => putFileBlob(a.id, files[i])));
    return simulateWrite(() => attachments);
  },

  /**
   * Endereco temporario para abrir o arquivo (object URL; quem abre revoga).
   * `null` quando o conteudo nao esta disponivel neste navegador.
   */
  async openUrl(id: Id): Promise<string | null> {
    const blob = await getFileBlob(id);
    return blob ? URL.createObjectURL(blob) : null;
  },
};
