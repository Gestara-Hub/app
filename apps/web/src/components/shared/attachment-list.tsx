"use client";

import { File as FileIcon, FileText, Image as ImageIcon, X } from "lucide-react";
import type { FileAttachment } from "@gestarahub/contracts";
import { Button } from "@/components/ui/button";
import { fileTypeLabel, formatBytes } from "@/lib/files";

function AttachmentIcon({ contentType }: { contentType: string }) {
  const Icon = contentType.startsWith("image/")
    ? ImageIcon
    : contentType === "application/pdf"
      ? FileText
      : FileIcon;
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

/**
 * Anexos ja salvos num registro: clicar no nome abre o arquivo; o X tira o
 * anexo (so vale ao salvar o formulario).
 */
export function AttachmentList({
  items,
  onOpen,
  onRemove,
  disabled,
}: {
  items: FileAttachment[];
  onOpen: (item: FileAttachment) => void;
  onRemove?: (item: FileAttachment) => void;
  disabled?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="divide-y rounded-lg border" aria-label="Arquivos salvos">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 px-3 py-2">
          <AttachmentIcon contentType={item.contentType} />
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="text-left text-sm font-medium break-all text-foreground hover:text-primary hover:underline"
            >
              {item.name}
            </button>
            <p className="text-xs text-muted-foreground">
              {fileTypeLabel(item.name, item.contentType)} · {formatBytes(item.sizeBytes)}
            </p>
          </div>
          {onRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={disabled}
              aria-label={`Remover ${item.name}`}
              onClick={() => onRemove(item)}
            >
              <X />
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
