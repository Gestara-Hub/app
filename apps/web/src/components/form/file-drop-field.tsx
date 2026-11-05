"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  Controller,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { CheckCircle2, FileText, File as FileIcon, Loader2, RotateCw, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fileIssue, fileTypeLabel, formatBytes, sameFile, type FileRules, type UploadItem } from "@/lib/files";
import { cn } from "@/lib/utils";
import { FieldShell, fieldAria } from "./field-shell";
import { useFileUploader } from "./file-uploader-context";
import { useDialogDirty } from "@/components/ui/dialog";

/** Miniatura da imagem (object URL revogada ao trocar/desmontar) ou icone do tipo. */
function FileThumb({ file }: { file: File }) {
  const isImage = file.type.startsWith("image/");
  const imgRef = useRef<HTMLImageElement>(null);

  // A URL vai direto no <img> (sistema externo), sem setState no effect.
  useEffect(() => {
    const img = imgRef.current;
    if (!isImage || !img) return;
    const next = URL.createObjectURL(file);
    img.src = next;
    return () => {
      URL.revokeObjectURL(next);
      img.removeAttribute("src");
    };
  }, [file, isImage]);

  if (isImage) {
    // eslint-disable-next-line @next/next/no-img-element -- object URL local, sem otimizacao do Next
    return <img ref={imgRef} alt="" className="size-9 shrink-0 rounded-md border bg-muted/50 object-cover" />;
  }
  const Icon = file.type === "application/pdf" ? FileText : FileIcon;
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
      <Icon className="size-4" />
    </span>
  );
}

export interface FileDropzoneProps extends FileRules {
  value: UploadItem[];
  onChange: (items: UploadItem[]) => void;
  /**
   * Valor atual fora do render: o envio termina depois e precisa da lista de
   * agora (no RHF, `getValues`). Sem ele, usa o ultimo `value` recebido.
   */
  getValue?: () => UploadItem[];
  onBlur?: () => void;
  /** Varios arquivos (padrao) ou um so (o novo substitui o anterior). */
  multiple?: boolean;
  disabled?: boolean;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
  inputRef?: (el: HTMLInputElement | null) => void;
}

let keySeq = 0;
// Sem crypto.randomUUID: falha fora de HTTPS (rede local).
const newKey = () => `up-${Date.now().toString(36)}-${(keySeq += 1)}`;

/** Motivo da falha sem o nome do arquivo (o nome ja esta na linha). */
function failureText(error: unknown): string {
  const message = (error as { fields?: { message?: string }[] })?.fields?.[0]?.message ?? (error as Error)?.message;
  const text = (message ?? "não foi possível enviar.").replace(/^“[^”]*”:\s*/, "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Area de arrastar e soltar (ou clicar) para anexar arquivos (04/11/2026):
 * cada arquivo sobe assim que entra na lista, um por vez e com novas
 * tentativas em falha de rede, e mostra a sua situacao (enviando, enviado,
 * falhou). Uma falha nao para os outros; o que falhou pode ser enviado de novo
 * ou tirado. Tirar da lista apaga o anexo ainda sem uso. Arquivo fora das
 * `FileRules` fica na lista em vermelho, sem subir; quem bloqueia o salvar e o
 * schema (`uploadsSchema`). Repetido (mesmo nome, tamanho e data) nao duplica.
 */
export function FileDropzone({
  value,
  onChange,
  getValue,
  onBlur,
  multiple = true,
  disabled,
  id,
  invalid,
  describedBy,
  inputRef,
  accept,
  maxSizeBytes,
  maxFiles,
  acceptLabel,
}: FileDropzoneProps) {
  const rules: FileRules = { accept, maxSizeBytes, maxFiles, acceptLabel };
  const uploader = useFileUploader();
  const inputEl = useRef<HTMLInputElement | null>(null);
  // Contador: dragenter/dragleave disparam nos filhos e fariam o destaque piscar.
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const lastValue = useRef(value);
  useEffect(() => {
    lastValue.current = value;
  }, [value]);

  // Formulario descartado: o que ja subiu e apagado na hora (sem esperar a
  // limpeza de 24 horas); o que ainda estava subindo e apagado ao terminar.
  const discardedRef = useRef(false);
  const dialogDirty = useDialogDirty();
  useEffect(() => {
    if (!dialogDirty || !uploader) return;
    return dialogDirty.onDiscard(() => {
      discardedRef.current = true;
      for (const item of lastValue.current) {
        if (item.attachment) void uploader.discard(item.attachment.id, { ifUnused: true });
      }
    });
  }, [dialogDirty, uploader]);

  // A lista voltou ao salvo por fora (ex.: "Descartar" da barra das
  // Configuracoes, ou o formulario recarregado depois de salvar): o que subiu e
  // saiu da lista sem a pessoa tirar e apagado se ninguem usar (o servidor
  // confere; depois de salvar ele esta em uso e fica).
  const seen = useRef(new Map<string, UploadItem>());
  const handled = useRef(new Set<string>());
  useEffect(() => {
    const keys = new Set(value.map((item) => item.key));
    for (const [key, item] of seen.current) {
      if (keys.has(key)) continue;
      seen.current.delete(key);
      if (handled.current.delete(key)) continue;
      if (item.attachment && uploader) void uploader.discard(item.attachment.id, { ifUnused: true });
    }
    for (const item of value) seen.current.set(item.key, item);
  }, [value, uploader]);

  const read = () => getValue?.() ?? lastValue.current;
  const write = (next: UploadItem[]) => {
    lastValue.current = next;
    onChange(next);
  };
  const patch = (key: string, changes: Partial<UploadItem>) =>
    write(read().map((item) => (item.key === key ? { ...item, ...changes } : item)));

  const start = (item: UploadItem) => {
    if (!uploader) {
      patch(item.key, { status: "error", error: "Envio indisponível nesta tela.", retryable: false });
      return;
    }
    uploader
      .upload(item.file, rules)
      .then((attachment) => {
        // Tirado da lista (ou formulario descartado) enquanto subia: o anexo nao fica sem dono.
        if (discardedRef.current || !read().some((current) => current.key === item.key)) {
          void uploader.discard(attachment.id);
          return;
        }
        patch(item.key, { status: "done", attachment, error: undefined, retryable: undefined });
      })
      .catch((error: unknown) =>
        patch(item.key, {
          status: "error",
          error: failureText(error),
          retryable: (error as { retryable?: boolean })?.retryable ?? true,
        }),
      );
  };

  const discard = (item: UploadItem) => {
    handled.current.add(item.key);
    if (item.attachment) void uploader?.discard(item.attachment.id);
  };

  const add = (incoming: FileList | File[] | null) => {
    if (!incoming || disabled) return;
    // Arquivo novo depois de um descarte (formulario reaberto sem desmontar).
    discardedRef.current = false;
    const current = read();
    const files = Array.from(incoming).filter((file) => !current.some((item) => sameFile(item.file, file)));
    if (files.length === 0) return;
    const chosen = multiple ? files : files.slice(0, 1);
    const room = multiple && maxFiles !== undefined ? Math.max(0, maxFiles - current.length) : Infinity;
    const created = chosen.map<UploadItem>((file, index) => {
      const issue = fileIssue(file, rules) ?? (index >= room ? `Passou do limite de ${maxFiles} arquivos.` : undefined);
      return issue
        ? { key: newKey(), file, status: "error", error: issue, retryable: false }
        : { key: newKey(), file, status: "uploading" };
    });
    if (!multiple) current.forEach(discard);
    write(multiple ? [...current, ...created] : created);
    created.filter((item) => item.status === "uploading").forEach(start);
  };

  const remove = (key: string) => {
    const item = read().find((current) => current.key === key);
    if (item) discard(item);
    write(read().filter((current) => current.key !== key));
  };

  const retry = (key: string) => {
    const item = read().find((current) => current.key === key);
    if (!item) return;
    patch(key, { status: "uploading", error: undefined, retryable: undefined });
    start({ ...item, status: "uploading" });
  };

  const onDragEnter = (event: DragEvent) => {
    event.preventDefault();
    if (disabled) return;
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragLeave = (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    add(event.dataTransfer.files);
    onBlur?.();
  };

  const limits = [
    acceptLabel ? acceptLabel.charAt(0).toUpperCase() + acceptLabel.slice(1) : null,
    // "cada" so quando cabe mais de um arquivo (a logo do certificado e uma so).
    maxSizeBytes !== undefined ? `até ${formatBytes(maxSizeBytes)}${multiple ? " cada" : ""}` : null,
    multiple && maxFiles !== undefined ? `no máximo ${maxFiles}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-2">
      <div
        onDragEnter={onDragEnter}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "relative flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-5 text-center transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
          disabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer hover:border-foreground/40 hover:bg-muted/40",
          dragging ? "border-primary bg-primary/5" : invalid ? "border-destructive/60" : "border-border",
        )}
        onClick={() => !disabled && inputEl.current?.click()}
      >
        <UploadCloud
          className={cn("size-6", dragging ? "text-primary" : "text-muted-foreground")}
          aria-hidden
        />
        <p className="text-sm text-foreground">
          {dragging ? (
            "Solte para anexar"
          ) : (
            <>
              <span className="hidden sm:inline">Arraste {multiple ? "arquivos" : "o arquivo"} aqui ou </span>
              <span className="font-medium text-primary underline-offset-2 sm:hover:underline">
                <span className="sm:hidden">Toque para </span>
                <span className="hidden sm:inline">clique para </span>
                escolher
              </span>
            </>
          )}
        </p>
        {limits ? <p className="text-xs text-muted-foreground">{limits}</p> : null}
        <input
          ref={(el) => {
            inputEl.current = el;
            inputRef?.(el);
          }}
          id={id}
          type="file"
          className="sr-only"
          multiple={multiple}
          accept={accept?.join(",")}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            add(event.target.files);
            // Limpa para permitir escolher o mesmo arquivo de novo depois de remover.
            event.target.value = "";
          }}
          onBlur={onBlur}
        />
      </div>

      {value.length > 0 ? (
        <ul className="divide-y rounded-lg border" aria-label="Arquivos anexados">
          {value.map((item) => {
            const failed = item.status === "error";
            const details = `${fileTypeLabel(item.file.name, item.file.type)} · ${formatBytes(item.file.size)}`;
            return (
              <li key={item.key} className={cn("flex items-center gap-3 px-3 py-2", failed && "bg-destructive/5")}>
                <FileThumb file={item.file} />
                <div className="min-w-0 flex-1">
                  <p className="min-w-0 break-words text-sm font-medium text-foreground">{item.file.name}</p>
                  <p
                    className={cn(
                      "flex items-center gap-1.5 text-xs",
                      failed ? "text-destructive" : "text-muted-foreground",
                    )}
                    aria-live="polite"
                  >
                    {item.status === "uploading" ? (
                      <>
                        <Loader2 className="size-3 animate-spin" aria-hidden />
                        Enviando… · {details}
                      </>
                    ) : item.status === "done" ? (
                      <>
                        <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" aria-hidden />
                        Enviado · {details}
                      </>
                    ) : (
                      item.error ?? "Não foi possível enviar."
                    )}
                  </p>
                </div>
                {failed && item.retryable ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={disabled}
                    aria-label={`Enviar ${item.file.name} de novo`}
                    title="Tentar de novo"
                    onClick={() => retry(item.key)}
                  >
                    <RotateCw />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={disabled}
                  aria-label={`Remover ${item.file.name}`}
                  onClick={() => remove(item.key)}
                >
                  <X />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

interface FileDropFieldProps<T extends FieldValues> extends FileRules {
  name: Path<T>;
  label?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  multiple?: boolean;
  id?: string;
}

/**
 * `FileDropzone` ligado ao RHF: o valor do campo e `UploadItem[]` (padrao `[]`).
 * Valide com `uploadsSchema(rules)` de `@/lib/files` usando as mesmas regras;
 * ao salvar, use `uploadedAttachments(valor)`.
 */
export function FileDropField<T extends FieldValues>({
  name,
  label,
  hint,
  required,
  disabled,
  multiple,
  id,
  ...rules
}: FileDropFieldProps<T>) {
  const { control, getValues } = useFormContext<T>();
  const fieldId = id ?? String(name);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const error = fieldState.error?.message;
        const aria = fieldAria(fieldId, error, hint);
        return (
          <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required}>
            <FileDropzone
              {...rules}
              id={fieldId}
              value={(field.value as UploadItem[] | undefined) ?? []}
              onChange={field.onChange}
              getValue={() => (getValues(name) as UploadItem[] | undefined) ?? []}
              onBlur={field.onBlur}
              multiple={multiple}
              disabled={disabled}
              invalid={Boolean(error)}
              describedBy={aria["aria-describedby"]}
              inputRef={field.ref}
            />
          </FieldShell>
        );
      }}
    />
  );
}
