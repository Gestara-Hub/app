"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CertificateTemplate, Id, SaveCertificateTemplate } from "@gestarahub/contracts";
import { queryKeys } from "@/lib/queryKeys";
import { attachmentsService } from "@/services/attachments/attachmentsService";
import { certificatesService } from "@/services/settings/certificatesService";

export function useCertificateTemplate() {
  return useQuery({
    queryKey: queryKeys.certificates.template,
    queryFn: () => certificatesService.getTemplate(),
  });
}

/** Salvar ou restaurar muda os certificados abertos (mesmo modelo para todos). */
function useInvalidateCertificates() {
  const qc = useQueryClient();
  return (saved: CertificateTemplate) => {
    qc.setQueryData(queryKeys.certificates.template, saved);
    qc.invalidateQueries({ queryKey: queryKeys.classes.certificates });
  };
}

export interface SaveCertificateTemplateInput {
  template: Omit<SaveCertificateTemplate, "logoFileId">;
  /** Logo atual que fica (sem arquivo novo). */
  keepLogoFileId?: Id;
  /** Logo nova: sobe antes e entra no lugar da atual. */
  logoFile?: File;
}

export function useSaveCertificateTemplate() {
  const invalidate = useInvalidateCertificates();
  return useMutation({
    mutationFn: async ({ template, keepLogoFileId, logoFile }: SaveCertificateTemplateInput) => {
      const logoFileId = logoFile ? (await certificatesService.uploadLogo(logoFile)).id : keepLogoFileId;
      return certificatesService.saveTemplate({ ...template, ...(logoFileId ? { logoFileId } : {}) });
    },
    onSuccess: invalidate,
  });
}

export function useResetCertificateTemplate() {
  const invalidate = useInvalidateCertificates();
  return useMutation({
    mutationFn: () => certificatesService.resetTemplate(),
    onSuccess: invalidate,
  });
}

/**
 * Endereco temporario (object URL) de um arquivo guardado, para o <img>.
 * Revogado ao trocar o id ou desmontar. `null` enquanto carrega ou sem arquivo.
 */
export function useStoredFileUrl(id?: Id): string | null {
  const [loaded, setLoaded] = useState<{ id: Id; url: string | null } | null>(null);
  useEffect(() => {
    if (!id) return;
    let active = true;
    let url: string | null = null;
    void attachmentsService.openUrl(id).then((next) => {
      if (!active) {
        if (next) URL.revokeObjectURL(next);
        return;
      }
      url = next;
      setLoaded({ id, url: next });
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  return id && loaded?.id === id ? loaded.url : null;
}

/** Object URL de um arquivo escolhido agora (ainda nao enviado), para a previa. */
export function useLocalFileUrl(file?: File): string | null {
  const [loaded, setLoaded] = useState<{ file: File; url: string } | null>(null);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    let active = true;
    // Fora do corpo do effect (o modo estrito monta, desmonta e monta de novo).
    void Promise.resolve().then(() => {
      if (active) setLoaded({ file, url });
    });
    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [file]);
  return file && loaded?.file === file ? loaded.url : null;
}
