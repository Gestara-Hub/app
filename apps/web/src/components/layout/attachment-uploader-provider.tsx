"use client";

import type { ReactNode } from "react";
import { FileUploaderProvider, type FileUploader } from "@/components/form";
import { attachmentsService } from "@/services/attachments/attachmentsService";

/** Envio de anexos para o campo de anexar de todas as telas do app (04/11/2026). */
const uploader: FileUploader = {
  upload: (file, rules) => attachmentsService.uploadOne(file, rules, "files"),
  discard: (id, options) => attachmentsService.discard(id, options),
};

export function AttachmentUploaderProvider({ children }: { children: ReactNode }) {
  return <FileUploaderProvider uploader={uploader}>{children}</FileUploaderProvider>;
}
