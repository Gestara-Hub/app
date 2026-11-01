import type {
  CertificateArtwork,
  CertificateBlock,
  CertificateTemplate,
  FileAttachment,
  Id,
  SaveCertificateTemplate,
} from "@gestarahub/contracts";
import {
  CERTIFICATE_BLOCKS,
  defaultCertificateTemplate,
  validateCertificateTemplate,
} from "@gestarahub/core/certificate";
import { CERTIFICATE_ARTWORK_RULES, CERTIFICATE_LOGO_RULES } from "@/lib/files";
import { delegateAll } from "../world/delegate";
import { notFoundError, nowIso, readOp, writeOp, validationError } from "@/services/world/ops";
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
 * Uma modalidade pode ter o proprio modelo (`categories.certificate_template`,
 * 31/10/2026): vale nos cursos dela; sem ele, o do espaco.
 */

/** Modelo do espaco (salvo, ou o modelo pronto da area do espaco). */
function spaceTemplate(): CertificateTemplate {
  return store.certificateTemplate ?? defaultCertificateTemplate(teamWords().title, store.organization.classSegment);
}

function modalityOf(modalityId: Id) {
  const category = store.categories.find((c) => c.id === modalityId);
  if (!category) throw notFoundError("Modalidade não encontrada.");
  return category;
}

/**
 * Modelo em vigor para quem monta o certificado: o da modalidade, se ela tem o
 * proprio; senao o do espaco.
 */
export function currentCertificateTemplate(modalityId?: Id): CertificateTemplate {
  const own = modalityId ? store.categories.find((c) => c.id === modalityId)?.certificateTemplate : undefined;
  return structuredClone(own ?? spaceTemplate());
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
    ...positionsOf(art),
    ...(art.logoSize ? { logoSize: art.logoSize } : {}),
    ...(art.qrSize ? { qrSize: art.qrSize } : {}),
  };
}

/** Os blocos arrastados, com 2 casas. */
function positionsOf(art: CertificateArtwork): Partial<Pick<CertificateArtwork, CertificateBlock>> {
  const out: Partial<Pick<CertificateArtwork, CertificateBlock>> = {};
  for (const block of CERTIFICATE_BLOCKS) {
    const pos = art[block];
    if (pos) out[block] = { x: round2(Number(pos.x)), y: round2(Number(pos.y)) };
  }
  return out;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

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
  /**
   * O modelo que a tela edita: o do espaco, ou o de uma modalidade. Modalidade
   * sem modelo proprio devolve o do espaco (`own: false`) como ponto de partida.
   */
  getTemplate(modalityId?: Id): Promise<CertificateTemplate & { own?: boolean }> {
    return readOp(async () => {
      if (!modalityId) return currentCertificateTemplate();
      const category = modalityOf(modalityId);
      return { ...structuredClone(category.certificateTemplate ?? spaceTemplate()), own: Boolean(category.certificateTemplate) };
    });
  },

  /** Modalidades com modelo proprio (a tela marca no seletor). */
  listModalitiesWithOwnTemplate(): Promise<Id[]> {
    return readOp(async () => store.categories.filter((c) => c.certificateTemplate).map((c) => c.id));
  },

  saveTemplate(payload: SaveCertificateTemplate, modalityId?: Id): Promise<CertificateTemplate> {
    return writeOp(async () => {
      assertFeature("certificates");
      const next = normalize(payload);
      const issues = validateCertificateTemplate(next);
      if (issues.length > 0) throw validationError(issues);
      const template: CertificateTemplate = { ...next, updatedAt: nowIso() };
      if (modalityId) {
        const category = modalityOf(modalityId);
        category.certificateTemplate = template;
        category.updatedAt = template.updatedAt ?? nowIso();
        auditLogService.record({
          action: "updated",
          target: { type: "settings", label: `Modelo de certificado de ${category.name}` },
          predicate: `atualizou o modelo de certificado de ${category.name}`,
        });
        return currentCertificateTemplate(modalityId);
      }
      store.certificateTemplate = template;
      auditLogService.record({
        action: "updated",
        target: { type: "settings", label: "Modelo de certificado" },
        predicate: "atualizou o modelo de certificado",
      });
      return currentCertificateTemplate();
    });
  },

  /** A modalidade volta a usar o modelo do espaco. */
  removeModalityTemplate(modalityId: Id): Promise<CertificateTemplate> {
    return writeOp(async () => {
      assertFeature("certificates");
      const category = modalityOf(modalityId);
      if (category.certificateTemplate) {
        category.certificateTemplate = undefined;
        category.updatedAt = nowIso();
        auditLogService.record({
          action: "updated",
          target: { type: "settings", label: `Modelo de certificado de ${category.name}` },
          predicate: `voltou ${category.name} ao modelo de certificado do espaço`,
        });
      }
      return currentCertificateTemplate(modalityId);
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
