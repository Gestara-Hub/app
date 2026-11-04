/**
 * Ponte para apagar o arquivo de um documento tirado da ficha (doc product/28).
 * A funcao de verdade usa o cliente administrativo e so existe no servidor:
 * `personDocumentFiles.ts` se registra aqui, carregado por `runWorld`. No
 * navegador (demonstracao) nao ha nada registrado e o arquivo fica no
 * armazenamento local do proprio navegador.
 */
export type DocumentFileRemover = (organizationId: string, fileIds: string[]) => Promise<void>;

let remover: DocumentFileRemover | null = null;

export function setDocumentFileRemover(fn: DocumentFileRemover | null): void {
  remover = fn;
}

export function getDocumentFileRemover(): DocumentFileRemover | null {
  return remover;
}
