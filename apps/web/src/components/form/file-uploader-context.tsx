"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { FileAttachment } from "@gestarahub/contracts";
import type { FileRules } from "@/lib/files";

/**
 * Quem envia e tira os arquivos do campo de anexar. O campo nao conhece os
 * servicos (fronteira de `components/form`): o layout do app entrega o envio
 * de anexos por este contexto.
 */
export interface FileUploader {
  /** Envia um arquivo (com novas tentativas em falha de rede). Erro de envio vem com `retryable`. */
  upload(file: File, rules: FileRules): Promise<FileAttachment>;
  /**
   * Tira um anexo ainda sem uso (arquivo tirado da lista, formulario
   * descartado). O servidor so apaga o sem uso e enviado por quem pede.
   * `ifUnused`: chamado sem saber se o formulario salvou (descarte, volta ao
   * salvo); fora do servidor (demonstracao local) nao apaga nada.
   */
  discard(id: string, options?: { ifUnused?: boolean }): Promise<void>;
}

const FileUploaderContext = createContext<FileUploader | null>(null);

export function FileUploaderProvider({ uploader, children }: { uploader: FileUploader; children: ReactNode }) {
  return <FileUploaderContext.Provider value={uploader}>{children}</FileUploaderContext.Provider>;
}

export function useFileUploader(): FileUploader | null {
  return useContext(FileUploaderContext);
}
