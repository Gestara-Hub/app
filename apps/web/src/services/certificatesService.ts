import type {
  CertificateTemplate,
  FileAttachment,
  SaveCertificateTemplate,
} from "@gestarahub/contracts";
import {
  defaultCertificateTemplate,
  validateCertificateTemplate,
} from "@gestarahub/core/certificate";
import { CERTIFICATE_LOGO_RULES } from "@/lib/files";
import { nowIso, simulateRead, simulateWrite, validationError } from "@/mocks/helpers";
import { store } from "@/mocks/store";
import { attachmentsService } from "./attachmentsService";
import { auditLogService } from "./auditLogService";
import { assertFeature } from "./subscriptionService";

/**
 * Modelo de certificado do espaco (doc 21, secao 1; recurso pago
 * `certificates`). Um por organizacao; sem modelo salvo vale o padrao. Ler e
 * livre (o Gratis ve a tela com cadeado); salvar, restaurar e enviar logo
 * exigem o Plano Pro. A logo segue o caminho dos anexos: o arquivo vai para o
 * armazenamento de arquivos (IndexedDB no mock) e o modelo guarda so o id.
 */

/** Modelo em vigor (salvo ou padrao), para quem monta o certificado. */
export function currentCertificateTemplate(): CertificateTemplate {
  return structuredClone(store.certificateTemplate ?? defaultCertificateTemplate());
}

/** Tira espacos das pontas; o texto guarda as quebras de linha do meio. */
function normalize(payload: SaveCertificateTemplate): SaveCertificateTemplate {
  const logoFileId = payload.logoFileId?.trim();
  return {
    layout: payload.layout,
    accentColor: payload.accentColor,
    title: payload.title.trim(),
    body: payload.body.trim(),
    signatures: payload.signatures.map((s) => ({ name: s.name.trim(), role: s.role.trim() })),
    showAttendance: Boolean(payload.showAttendance),
    ...(logoFileId ? { logoFileId } : {}),
  };
}

export const certificatesService = {
  getTemplate(): Promise<CertificateTemplate> {
    return simulateRead(() => currentCertificateTemplate());
  },

  saveTemplate(payload: SaveCertificateTemplate): Promise<CertificateTemplate> {
    return simulateWrite(() => {
      assertFeature("certificates");
      const next = normalize(payload);
      const issues = validateCertificateTemplate(next);
      if (issues.length > 0) throw validationError(issues);
      store.certificateTemplate = { ...next, updatedAt: nowIso() };
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
    return simulateWrite(() => {
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
};
