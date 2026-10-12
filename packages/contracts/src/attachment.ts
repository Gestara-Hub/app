import type { DateTimeISO, Id } from "./common";

/**
 * Arquivo anexado a um registro (comprovante, nota, boleto). O registro guarda
 * so os metadados; o conteudo fica no armazenamento de arquivos (no mock, o
 * IndexedDB do navegador; com o backend, o storage de arquivos).
 */
export interface FileAttachment {
  id: Id;
  name: string;
  /** Tipo MIME ("application/pdf", "image/png"). */
  contentType: string;
  sizeBytes: number;
  uploadedAt: DateTimeISO;
}
