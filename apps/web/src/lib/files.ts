import { z } from "zod";

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

/** Comprovante de pagamento: imagem ou PDF, ate 10 MB cada, no maximo 5. */
export const RECEIPT_FILE_RULES = {
  accept: ["image/*", "application/pdf"],
  maxSizeBytes: 10 * MB,
  maxFiles: 5,
  acceptLabel: "imagem ou PDF",
} as const satisfies FileRules;

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
