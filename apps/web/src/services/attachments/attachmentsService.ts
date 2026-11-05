import type { FileAttachment, Id } from "@gestarahub/contracts";
import { MAX_UPLOAD_BYTES, RECEIPT_FILE_RULES, fileIssue, formatBytes, type FileRules } from "@/lib/files";
import { realAccountInBrowser } from "../world/delegate";
import { deleteFileBlob, getFileBlob, putFileBlob } from "@/mocks/file-blobs";
import { newId, nowIso, writeOp, validationError } from "@/services/world/ops";
import { logWarn } from "@/lib/log";

/**
 * Envio e leitura de anexos (comprovantes, notas, boletos, logos).
 * No tenant Supabase: envia via HTTP multipart para /api/attachments (Supabase Storage bucket 'attachments')
 * e serve via endpoint autenticado /api/attachments/[id].
 * No tenant mock: guarda no IndexedDB do navegador (mocks/file-blobs.ts).
 */
/** Tentativas por arquivo em falha de rede ou do servidor (intermitencia). */
const SEND_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class SendError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

async function sendOnce(file: File): Promise<FileAttachment> {
  const formData = new FormData();
  formData.append("files", file);
  let res: Response;
  try {
    res = await fetch("/api/attachments", { method: "POST", body: formData });
  } catch {
    throw new SendError("não foi possível enviar. Confira a internet e tente de novo.", true);
  }
  if (!res.ok) {
    const errData = (await res.json().catch(() => ({}))) as { message?: string };
    if (res.status === 413) throw new SendError(`maior que ${formatBytes(MAX_UPLOAD_BYTES)}.`, false);
    const retryable = res.status >= 500 || res.status === 429;
    throw new SendError(errData.message || "não foi possível enviar.", retryable);
  }
  const data = (await res.json()) as { attachments: FileAttachment[] };
  return data.attachments[0];
}

/**
 * Envia um arquivo, tentando de novo sozinho em falha de rede ou do servidor
 * (ate 3 vezes, com pausa crescente). Formato, tamanho e permissao nao repetem.
 */
async function sendWithRetry(file: File, field: string): Promise<FileAttachment> {
  let last: SendError | undefined;
  for (let attempt = 1; attempt <= SEND_ATTEMPTS; attempt += 1) {
    try {
      const saved = await sendOnce(file);
      // Copia local no navegador por conveniencia (abrir sem baixar de novo).
      await putFileBlob(saved.id, file).catch(() => {});
      return saved;
    } catch (err) {
      last = err instanceof SendError ? err : new SendError("não foi possível enviar.", true);
      if (!last.retryable || attempt === SEND_ATTEMPTS) break;
      await sleep(700 * attempt);
    }
  }
  // Falha de rede de quem usa: aviso, nao erro do sistema (nao entra no resumo de erros).
  if (last?.retryable) logWarn("[attachmentsService] Envio falhou depois das tentativas:", last.message);
  throw Object.assign(validationError([{ field, message: `“${file.name}”: ${last?.message ?? "não foi possível enviar."}` }]), {
    retryable: last?.retryable ?? true,
  });
}

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
      // Um arquivo por requisicao: cada um cabe no limite de corpo da Vercel
      // (4,5 MB) e o erro aponta o arquivo certo. Conta real nao cai no
      // armazenamento do navegador: o erro aparece no campo.
      const attachments: FileAttachment[] = [];
      for (const file of files) attachments.push(await sendWithRetry(file, field));
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

  /** Envia um arquivo do campo de anexar (sobe ao escolher, antes de salvar). */
  async uploadOne(file: File, rules: FileRules, field = "files"): Promise<FileAttachment> {
    const [saved] = await this.upload([file], rules, field);
    return saved;
  },

  /**
   * Tira um anexo ainda sem uso (arquivo tirado da lista antes de salvar). O
   * servidor so apaga o enviado por quem pede e que nenhum registro usa; o que
   * falhar aqui a rotina diaria apaga depois.
   */
  async discard(id: Id): Promise<void> {
    if (realAccountInBrowser()) {
      await fetch(`/api/attachments/${id}`, { method: "DELETE" }).catch(() => undefined);
      return;
    }
    await deleteFileBlob(id).catch(() => undefined);
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
