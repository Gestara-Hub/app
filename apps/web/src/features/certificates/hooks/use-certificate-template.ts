"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CertificateTemplate, Id, SaveCertificateTemplate } from "@gestarahub/contracts";
import { queryKeys } from "@/lib/queryKeys";
import { attachmentsService } from "@/services/attachments/attachmentsService";
import { certificatesService } from "@/services/settings/certificatesService";

/** Modelo do espaco, ou o de uma modalidade (o do espaco quando ela nao tem o proprio). */
export function useCertificateTemplate(modalityId?: Id) {
  return useQuery({
    queryKey: queryKeys.certificates.template(modalityId),
    queryFn: () => certificatesService.getTemplate(modalityId),
  });
}

/** Ids das modalidades com modelo proprio (seletor "Vale para"). */
export function useModalitiesWithOwnTemplate() {
  return useQuery({
    queryKey: queryKeys.certificates.ownTemplates,
    queryFn: () => certificatesService.listModalitiesWithOwnTemplate(),
  });
}

/** Salvar ou restaurar muda os certificados abertos e as modalidades com modelo proprio. */
function useInvalidateCertificates() {
  const qc = useQueryClient();
  return (saved: CertificateTemplate, modalityId?: Id) => {
    qc.setQueryData(queryKeys.certificates.template(modalityId), saved);
    qc.invalidateQueries({ queryKey: queryKeys.certificates.ownTemplates });
    qc.invalidateQueries({ queryKey: queryKeys.classes.certificates });
  };
}

export interface SaveCertificateTemplateInput {
  /** Em `artwork`, o `fileId` da arte atual (ou vazio quando vem um arquivo novo). */
  template: Omit<SaveCertificateTemplate, "logoFileId">;
  /** Logo atual que fica (sem arquivo novo). */
  keepLogoFileId?: Id;
  /** Logo nova: sobe antes e entra no lugar da atual. */
  logoFile?: File;
  /** Arte de fundo nova ("Minha arte"): sobe antes e entra em `artwork.fileId`. */
  artworkFile?: File;
  /** Modelo so desta modalidade; sem ele, o do espaco. */
  modalityId?: Id;
}

export function useSaveCertificateTemplate() {
  const invalidate = useInvalidateCertificates();
  return useMutation({
    mutationFn: async ({ template, keepLogoFileId, logoFile, artworkFile, modalityId }: SaveCertificateTemplateInput) => {
      const logoFileId = logoFile ? (await certificatesService.uploadLogo(logoFile)).id : keepLogoFileId;
      const artwork =
        template.layout === "custom" && template.artwork
          ? { ...template.artwork, fileId: artworkFile ? (await certificatesService.uploadArtwork(artworkFile)).id : template.artwork.fileId }
          : undefined;
      return certificatesService.saveTemplate(
        {
          ...template,
          ...(logoFileId ? { logoFileId } : {}),
          ...(artwork ? { artwork } : {}),
        },
        modalityId,
      );
    },
    onSuccess: (saved, { modalityId }) => invalidate(saved, modalityId),
  });
}

/** A modalidade volta ao modelo do espaco. */
export function useRemoveModalityTemplate() {
  const invalidate = useInvalidateCertificates();
  return useMutation({
    mutationFn: (modalityId: Id) => certificatesService.removeModalityTemplate(modalityId),
    onSuccess: (saved, modalityId) => invalidate(saved, modalityId),
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
