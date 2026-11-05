"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FileAttachment, CertificateKind, CertificateTemplate, Id, SaveCertificateTemplate } from "@gestarahub/contracts";
import { queryKeys } from "@/lib/queryKeys";
import { attachmentsService } from "@/services/attachments/attachmentsService";
import { certificatesService } from "@/services/settings/certificatesService";

/** Modelo do espaco, ou o de uma modalidade (o do espaco quando ela nao tem o proprio), do tipo (curso ou graduacao). */
export function useCertificateTemplate(modalityId?: Id, kind: CertificateKind = "course") {
  return useQuery({
    queryKey: queryKeys.certificates.template(modalityId, kind),
    queryFn: () => certificatesService.getTemplate(modalityId, kind),
  });
}

/** Ids das modalidades com modelo proprio do tipo (seletor "Vale para"). */
export function useModalitiesWithOwnTemplate(kind: CertificateKind = "course") {
  return useQuery({
    queryKey: queryKeys.certificates.ownTemplates(kind),
    queryFn: () => certificatesService.listModalitiesWithOwnTemplate(kind),
  });
}

/** Salvar ou restaurar muda os certificados abertos e as modalidades com modelo proprio. */
function useInvalidateCertificates() {
  const qc = useQueryClient();
  return (saved: CertificateTemplate, modalityId?: Id, kind: CertificateKind = "course") => {
    qc.setQueryData(queryKeys.certificates.template(modalityId, kind), saved);
    qc.invalidateQueries({ queryKey: queryKeys.certificates.ownTemplates(kind) });
    qc.invalidateQueries({ queryKey: kind === "graduation" ? queryKeys.clients.graduationCertificates : queryKeys.classes.certificates });
  };
}

export interface SaveCertificateTemplateInput {
  /** Em `artwork`, o `fileId` da arte atual (ou vazio quando vem um arquivo novo). */
  template: Omit<SaveCertificateTemplate, "logoFileId">;
  /** Logo atual que fica (sem arquivo novo). */
  keepLogoFileId?: Id;
  /** Logo nova, ja enviada no formulario (ao ser escolhida); entra no lugar da atual. */
  newLogo?: FileAttachment;
  /** Arte de fundo nova ("Minha arte"), ja enviada; entra em `artwork.fileId`. */
  newArtwork?: FileAttachment;
  /** Modelo so desta modalidade; sem ele, o do espaco. */
  modalityId?: Id;
  /** Curso (padrao) ou graduacao. */
  kind?: CertificateKind;
}

export function useSaveCertificateTemplate() {
  const invalidate = useInvalidateCertificates();
  return useMutation({
    mutationFn: async ({ template, keepLogoFileId, newLogo, newArtwork, modalityId, kind }: SaveCertificateTemplateInput) => {
      const logoFileId = newLogo ? newLogo.id : keepLogoFileId;
      const artwork =
        template.layout === "custom" && template.artwork
          ? { ...template.artwork, fileId: newArtwork ? newArtwork.id : template.artwork.fileId }
          : undefined;
      return certificatesService.saveTemplate(
        {
          ...template,
          ...(logoFileId ? { logoFileId } : {}),
          ...(artwork ? { artwork } : {}),
        },
        modalityId,
        kind ?? "course",
      );
    },
    onSuccess: (saved, { modalityId, kind }) => invalidate(saved, modalityId, kind ?? "course"),
  });
}

/** A modalidade volta ao modelo do espaco (do tipo). */
export function useRemoveModalityTemplate(kind: CertificateKind = "course") {
  const invalidate = useInvalidateCertificates();
  return useMutation({
    mutationFn: (modalityId: Id) => certificatesService.removeModalityTemplate(modalityId, kind),
    onSuccess: (saved, modalityId) => invalidate(saved, modalityId, kind),
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
