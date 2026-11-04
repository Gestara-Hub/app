import { delegateAll } from "../world/delegate";
import { personDocumentsServiceImpl } from "./personDocumentsService";

export { personDocumentsServiceImpl };

/** Conta real no navegador: roda no servidor sobre o banco (doc 15, fatia 2). */
export const personDocumentsService = delegateAll("personDocuments", personDocumentsServiceImpl);

/**
 * Endereco para abrir o arquivo. Conta real: a rota que confere quem pode ver
 * (doc product/28). Demonstracao: o arquivo guardado no proprio navegador.
 */
export async function personDocumentUrl(doc: { id: string; file: { id: string } }): Promise<string | null> {
  const { realAccountInBrowser } = await import("../world/delegate");
  if (realAccountInBrowser()) return `/api/person-documents/${doc.id}`;
  const { attachmentsService } = await import("../attachments/attachmentsService");
  return attachmentsService.openUrl(doc.file.id);
}
