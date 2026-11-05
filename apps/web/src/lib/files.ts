import { z } from "zod";
import type { FileAttachment } from "@gestarahub/contracts";

/**
 * Regras de arquivo compartilhadas pelo `FileDropField` (marca o arquivo
 * invalido na lista) e pelo `filesSchema` (validacao do RHF via Zod), para as
 * duas falarem a mesma coisa.
 */
export interface FileRules {
  /** Tipos aceitos: MIME exato ("application/pdf"), curinga ("image/*") ou extensao (".pdf"). */
  accept?: readonly string[];
  /** Tamanho maximo por arquivo, em bytes. */
  maxSizeBytes?: number;
  /** Quantidade maxima de arquivos. */
  maxFiles?: number;
  /** Como os tipos aparecem na tela ("imagem ou PDF"); usado nas mensagens. */
  acceptLabel?: string;
}

const MB = 1024 * 1024;

/**
 * Teto de todo envio de arquivo (04/11/2026): 4 MB por arquivo. Na Vercel a
 * requisicao aceita ate 4,5 MB de corpo; cada arquivo vai numa requisicao
 * propria. Vale tambem na rota de envio e no armazenamento (migracao 84).
 */
export const MAX_UPLOAD_BYTES = 4 * MB;

/** Comprovante de pagamento: imagem ou PDF, ate 4 MB cada, no maximo 5. */
export const RECEIPT_FILE_RULES = {
  accept: ["image/*", "application/pdf"],
  maxSizeBytes: MAX_UPLOAD_BYTES,
  maxFiles: 5,
  acceptLabel: "imagem ou PDF",
} as const satisfies FileRules;

/** Anexos de lancamento (entrada ou saida): mesmos tipos, ate 10 no total. */
export const ENTRY_ATTACHMENT_RULES = {
  ...RECEIPT_FILE_RULES,
  maxFiles: 10,
} as const satisfies FileRules;

/** Documento da ficha (atestado, termo, CREF): um arquivo, imagem ou PDF, ate 4 MB (doc product/28). */
export const PERSON_DOCUMENT_FILE_RULES = {
  ...RECEIPT_FILE_RULES,
  maxFiles: 1,
} as const satisfies FileRules;

/** Logo do certificado: uma imagem de ate 1 MB (doc 21, secao 1). */
export const CERTIFICATE_LOGO_RULES = {
  accept: ["image/*"],
  maxSizeBytes: 1 * MB,
  maxFiles: 1,
  acceptLabel: "imagem",
} as const satisfies FileRules;

/** Arte de fundo do certificado (doc 21 §1.1): PNG ou JPG em A4 deitado, ate 2 MB. */
export const CERTIFICATE_ARTWORK_RULES = {
  accept: ["image/png", "image/jpeg"],
  maxSizeBytes: 2 * MB,
  maxFiles: 1,
  acceptLabel: "PNG ou JPG",
} as const satisfies FileRules;

/** Rotulo curto do tipo ("PDF", "PNG"); cai na extensao quando nao ha MIME. */
export function fileTypeLabel(name: string, contentType: string): string {
  const sub = contentType.split("/")[1];
  if (sub) return sub.replace("jpeg", "jpg").toUpperCase();
  const ext = name.split(".").pop();
  return ext && ext !== name ? ext.toUpperCase() : "Arquivo";
}

/** Bytes -> "820 KB", "1,2 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = value < 10 ? 1 : 0;
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: digits })} ${units[unit]}`;
}

/** O arquivo bate com algum dos tipos aceitos (sem `accept` = aceita tudo). */
export function matchesAccept(file: Pick<File, "name" | "type">, accept?: readonly string[]): boolean {
  if (!accept || accept.length === 0) return true;
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return accept.some((rule) => {
    const r = rule.trim().toLowerCase();
    if (r.startsWith(".")) return name.endsWith(r);
    if (r.endsWith("/*")) return mime.startsWith(r.slice(0, -1));
    return mime === r;
  });
}

/** Motivo de o arquivo ser recusado, ou `undefined` se esta ok. */
export function fileIssue(file: File, rules: FileRules): string | undefined {
  if (!matchesAccept(file, rules.accept)) {
    return rules.acceptLabel ? `Formato não aceito (use ${rules.acceptLabel}).` : "Formato não aceito.";
  }
  if (rules.maxSizeBytes !== undefined && file.size > rules.maxSizeBytes) {
    return `Arquivo maior que ${formatBytes(rules.maxSizeBytes)}.`;
  }
  return undefined;
}

/** Mesmo arquivo escolhido de novo (nome + tamanho + data de modificacao). */
export function sameFile(a: File, b: File): boolean {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

const fileSchema = z.custom<File>(
  (value) => typeof File !== "undefined" && value instanceof File,
  { error: "Arquivo inválido." },
);

/**
 * Lista de arquivos para o RHF (`File[]`). Valida quantidade, tipo e tamanho
 * com as mesmas `FileRules` do campo. `required` exige ao menos um arquivo.
 */
export function filesSchema(rules: FileRules & { required?: boolean }) {
  return z.array(fileSchema).superRefine((files, ctx) => {
    if (rules.required && files.length === 0) {
      ctx.addIssue({ code: "custom", message: "Anexe pelo menos um arquivo." });
      return;
    }
    if (rules.maxFiles !== undefined && files.length > rules.maxFiles) {
      ctx.addIssue({
        code: "custom",
        message: `Anexe no máximo ${rules.maxFiles} ${rules.maxFiles === 1 ? "arquivo" : "arquivos"}.`,
      });
    }
    const invalid = files.filter((f) => fileIssue(f, rules));
    if (invalid.length > 0) {
      const issue = invalid.length === 1 ? fileIssue(invalid[0], rules)! : "";
      ctx.addIssue({
        code: "custom",
        message:
          invalid.length === 1
            ? `Remova “${invalid[0].name}”: ${issue.charAt(0).toLowerCase()}${issue.slice(1)}`
            : `Remova os ${invalid.length} arquivos marcados em vermelho.`,
      });
    }
  });
}

/**
 * Arquivo do campo de anexar (04/11/2026): sobe assim que e escolhido, um por
 * vez, e cada um tem a sua situacao. O formulario so salva com todos
 * enviados; quem falhou pode ser enviado de novo ou tirado da lista.
 */
export type UploadStatus = "uploading" | "done" | "error";

export interface UploadItem {
  /** Chave local da linha (o mesmo arquivo escolhido de novo vira outra linha so se for outro). */
  key: string;
  file: File;
  status: UploadStatus;
  /** Anexo gravado (status "done"). */
  attachment?: FileAttachment;
  /** Motivo da falha (status "error"). */
  error?: string;
  /** Falha de envio que vale tentar de novo (nao a de formato ou tamanho). */
  retryable?: boolean;
}

/** Anexos ja enviados da lista, na ordem. */
export function uploadedAttachments(items: UploadItem[] | undefined): FileAttachment[] {
  return (items ?? []).flatMap((item) => (item.status === "done" && item.attachment ? [item.attachment] : []));
}

const uploadItemSchema = z.custom<UploadItem>(
  (value) =>
    typeof value === "object" &&
    value !== null &&
    "file" in value &&
    typeof File !== "undefined" &&
    (value as UploadItem).file instanceof File,
  { error: "Arquivo inválido." },
);

/**
 * Lista do campo de anexar para o RHF (`UploadItem[]`): as mesmas regras de
 * `filesSchema` e, alem delas, todos precisam estar enviados para salvar.
 */
export function uploadsSchema(rules: FileRules & { required?: boolean }) {
  return z.array(uploadItemSchema).superRefine((items, ctx) => {
    if (rules.required && items.length === 0) {
      ctx.addIssue({ code: "custom", message: "Anexe pelo menos um arquivo." });
      return;
    }
    if (rules.maxFiles !== undefined && items.length > rules.maxFiles) {
      ctx.addIssue({
        code: "custom",
        message: `Anexe no máximo ${rules.maxFiles} ${rules.maxFiles === 1 ? "arquivo" : "arquivos"}.`,
      });
    }
    const invalid = items.filter((item) => fileIssue(item.file, rules));
    if (invalid.length > 0) {
      const issue = invalid.length === 1 ? fileIssue(invalid[0].file, rules)! : "";
      ctx.addIssue({
        code: "custom",
        message:
          invalid.length === 1
            ? `Remova “${invalid[0].file.name}”: ${issue.charAt(0).toLowerCase()}${issue.slice(1)}`
            : `Remova os ${invalid.length} arquivos marcados em vermelho.`,
      });
      return;
    }
    if (items.some((item) => item.status === "uploading")) {
      ctx.addIssue({ code: "custom", message: "Aguarde o envio dos arquivos." });
    } else if (items.some((item) => item.status === "error")) {
      ctx.addIssue({ code: "custom", message: "Envie de novo ou tire o arquivo que falhou." });
    }
  });
}
