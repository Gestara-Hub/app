"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  Controller,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { FileText, File as FileIcon, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fileIssue, formatBytes, sameFile, type FileRules } from "@/lib/files";
import { cn } from "@/lib/utils";
import { FieldShell, fieldAria } from "./field-shell";

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

/** Rotulo curto do tipo ("PDF", "PNG"); cai no MIME quando nao ha subtipo. */
function typeLabel(file: File): string {
  const sub = file.type.split("/")[1];
  if (sub) return sub.replace("jpeg", "jpg").toUpperCase();
  const ext = file.name.split(".").pop();
  return ext && ext !== file.name ? ext.toUpperCase() : "Arquivo";
}

export interface FileDropzoneProps extends FileRules {
  value: File[];
  onChange: (files: File[]) => void;
  onBlur?: () => void;
  /** Varios arquivos (padrao) ou um so (o novo substitui o anterior). */
  multiple?: boolean;
  disabled?: boolean;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
  inputRef?: (el: HTMLInputElement | null) => void;
}

/**
 * Area de arrastar e soltar (ou clicar) para escolher arquivos. Controlado por
 * `value`/`onChange` (`File[]`); nao envia nada, so entrega os `File` com
 * `name`, `type` (MIME) e `size`. Arquivo fora das `FileRules` fica na lista
 * marcado em vermelho com o motivo; quem bloqueia o envio e o schema
 * (`filesSchema`). Repetido (mesmo nome, tamanho e data) nao duplica.
 */
export function FileDropzone({
  value,
  onChange,
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
  const inputEl = useRef<HTMLInputElement | null>(null);
  // Contador: dragenter/dragleave disparam nos filhos e fariam o destaque piscar.
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);

  const add = (incoming: FileList | File[] | null) => {
    if (!incoming || disabled) return;
    const list = Array.from(incoming);
    if (list.length === 0) return;
    if (!multiple) {
      onChange([list[0]]);
      return;
    }
    const next = [...value];
    for (const file of list) {
      if (!next.some((f) => sameFile(f, file))) next.push(file);
    }
    onChange(next);
  };

  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

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
    maxSizeBytes !== undefined ? `até ${formatBytes(maxSizeBytes)} cada` : null,
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
          {value.map((file, index) => {
            const issue = fileIssue(file, rules);
            return (
              <li
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className={cn("flex items-center gap-3 px-3 py-2", issue && "bg-destructive/5")}
              >
                <FileThumb file={file} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground" title={file.name}>
                    {file.name}
                  </p>
                  <p className={cn("text-xs", issue ? "text-destructive" : "text-muted-foreground")}>
                    {issue ?? `${typeLabel(file)} · ${formatBytes(file.size)}`}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={disabled}
                  aria-label={`Remover ${file.name}`}
                  onClick={() => remove(index)}
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
 * `FileDropzone` ligado ao RHF: o valor do campo e `File[]` (padrao `[]`).
 * Valide com `filesSchema(rules)` de `@/lib/files` usando as mesmas regras.
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
  const { control } = useFormContext<T>();
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
              value={(field.value as File[] | undefined) ?? []}
              onChange={field.onChange}
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
