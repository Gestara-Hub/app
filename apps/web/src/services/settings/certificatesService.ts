import type {
  CertificateArtwork,
  CertificateTemplate,
  FileAttachment,
  SaveCertificateTemplate,
} from "@gestarahub/contracts";
import {
  defaultCertificateTemplate,
  validateCertificateTemplate,
} from "@gestarahub/core/certificate";
import { CERTIFICATE_ARTWORK_RULES, CERTIFICATE_LOGO_RULES } from "@/lib/files";
import { delegateAll } from "../world/delegate";
import { nowIso, readOp, writeOp, validationError } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { attachmentsService } from "../attachments/attachmentsService";
import { auditLogService } from "../audit/auditLogService";
import { assertFeature } from "../subscription/subscriptionService";
import { teamWords } from "../world/nouns";

/**
 * Modelo de certificado do espaco (doc 21, secao 1; recurso pago
 * `certificates`). Um por organizacao; sem modelo salvo vale o padrao. Ler e
 * livre (o Gratis ve a tela com cadeado); salvar, restaurar e enviar logo
 * exigem o Plano Profissional. A logo segue o caminho dos anexos: o arquivo vai para o
 * armazenamento de arquivos (IndexedDB no mock, bucket privado no Supabase) e
 * o modelo guarda so o id. Na conta real o modelo vive em
 * `organizations.certificate_template` (doc 15, fatia 1); o store e so cache.
 */

/** Modelo em vigor (salvo ou padrao), para quem monta o certificado. */
export function currentCertificateTemplate(): CertificateTemplate {
  return structuredClone(store.certificateTemplate ?? defaultCertificateTemplate(teamWords().title));
}

/** Ajustes da arte, so no layout "Minha arte" (nos outros a arte e esquecida). */
function normalizeArtwork(payload: SaveCertificateTemplate): CertificateArtwork | undefined {
  const art = payload.artwork;
  if (payload.layout !== "custom" || !art) return undefined;
  return {
    fileId: String(art.fileId ?? "").trim(),
    textPosition: art.textPosition,
    ink: art.ink,
    hidden: Array.isArray(art.hidden) ? [...new Set(art.hidden)] : [],
  };
}

/** Tira espacos das pontas; o texto guarda as quebras de linha do meio. */
function normalize(payload: SaveCertificateTemplate): SaveCertificateTemplate {
  const logoFileId = payload.logoFileId?.trim();
  const artwork = normalizeArtwork(payload);
  return {
    layout: payload.layout,
    accentColor: payload.accentColor,
    title: payload.title.trim(),
    body: payload.body.trim(),
    signatures: payload.signatures.map((s) => ({ name: s.name.trim(), role: s.role.trim() })),
    showAttendance: Boolean(payload.showAttendance),
    ...(logoFileId ? { logoFileId } : {}),
    ...(artwork ? { artwork } : {}),
  };
}

export const certificatesServiceImpl = {
  getTemplate(): Promise<CertificateTemplate> {
    return readOp(async () => {
      return currentCertificateTemplate();
    });
  },

  saveTemplate(payload: SaveCertificateTemplate): Promise<CertificateTemplate> {
    return writeOp(async () => {
      assertFeature("certificates");
      const next = normalize(payload);
      const issues = validateCertificateTemplate(next);
      if (issues.length > 0) throw validationError(issues);
      const template: CertificateTemplate = { ...next, updatedAt: nowIso() };
      store.certificateTemplate = template;
      auditLogService.record({
        action: "updated",
        target: { type: "settings", label: "Modelo de certificado" },
        predicate: "atualizou o modelo de certificado",
      });
      return currentCertificateTemplate();
    });
  },

  /** "Restaurar padrão": apaga o modelo salvo (logo inclusa). */
  resetTemplate(): Promise<CertificateTemplate> {
    return writeOp(async () => {
      assertFeature("certificates");
      if (store.certificateTemplate) {
        // O `store` e um proxy do tenant ativo (sem `delete`): `undefined` = padrao.
        store.certificateTemplate = undefined;
        auditLogService.record({
          action: "updated",
          target: { type: "settings", label: "Modelo de certificado" },
          predicate: "restaurou o modelo de certificado padrão",
        });
      }
      return currentCertificateTemplate();
    });
  },

  /** Envia a logo (imagem ate 1 MB). Devolve o anexo; o id vai no `saveTemplate`. */
  async uploadLogo(file: File): Promise<FileAttachment> {
    assertFeature("certificates");
    const [logo] = await attachmentsService.upload([file], CERTIFICATE_LOGO_RULES, "logo");
    return logo;
  },

  /** Envia a arte de fundo (PNG ou JPG ate 2 MB). Devolve o anexo; o id vai em `artwork.fileId`. */
  async uploadArtwork(file: File): Promise<FileAttachment> {
    assertFeature("certificates");
    const [artwork] = await attachmentsService.upload([file], CERTIFICATE_ARTWORK_RULES, "artwork");
    return artwork;
  },
};

/** Conta real no navegador: roda no servidor sobre o banco (doc 15, fatia 2). */
export const certificatesService = delegateAll("certificates", certificatesServiceImpl, ["uploadLogo", "uploadArtwork"]);
