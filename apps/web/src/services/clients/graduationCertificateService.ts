import type {
  EventGraduationCertificatesBatch,
  GraduationCertificate,
  GraduationCertificateDocument,
  GraduationOption,
  Id,
  IssuedCertificate,
  IssuedCertificateInfo,
  StudentModalityProgression,
  StudentPromotionHistoryEntry,
} from "@gestarahub/contracts";
import { buildGraduationCertificate, newCertificateCode } from "@gestarahub/core/certificate";
import { resolveModalityTrack, resolveTrackStyle } from "@/lib/progression-tracks";
import { getCurrentActor } from "@/mocks/currentActor";
import { newId, notFoundError, nowIso, readOp, writeOp } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { auditLogService } from "../audit/auditLogService";
import { issuedCertificateLabel } from "../classes/courseCertificateService";
import { assertCanManageProgression, teacherTeachesStudent } from "../classes/teacherScope";
import { currentCertificateTemplate } from "../settings/certificatesService";
import { assertFeature } from "../subscription/subscriptionService";
import { NOT_FOUND, clone, todayISO } from "./clientStore";

/**
 * Certificado de graduacao (doc 21 §1.6): nasce do registro de graduacao do
 * aluno (`promotionHistory`), nao da turma. No maximo um por registro; o
 * codigo de verificacao nasce na primeira abertura, como no de curso. So em
 * modalidade com trilha; recurso pago `certificates`.
 */

type Client = (typeof store.clients)[number];

interface Promotion {
  client: Client;
  modalityId: Id;
  progression: StudentModalityProgression;
  entry: StudentPromotionHistoryEntry;
}

function promotionOf(studentId: Id, promotionId: Id): Promotion {
  const client = store.clients.find((c) => c.id === studentId);
  if (!client) throw notFoundError(NOT_FOUND);
  for (const [modalityId, progression] of Object.entries(client.progressions ?? {})) {
    const entry = progression.promotionHistory.find((h) => h.id === promotionId);
    if (entry) return { client, modalityId, progression, entry };
  }
  throw notFoundError("Graduação não encontrada.");
}

/** Professor da turma ativa do aluno na modalidade (quando o registro nao traz o examinador). */
function teacherOfStudentIn(studentId: Id, modalityId: Id): string {
  for (const e of store.enrollments) {
    if (e.studentId !== studentId || e.status !== "active") continue;
    const g = store.classGroups.find((x) => x.id === e.classGroupId);
    if (g?.modalityId !== modalityId) continue;
    return store.professionals.find((p) => p.id === g.instructorId)?.name ?? "";
  }
  return "";
}

/** Os dados do certificado de uma graduacao, como sairiam agora (sem emitir). */
function certificateDataOf({ client, modalityId, progression, entry }: Promotion): GraduationCertificate {
  const category = store.categories.find((c) => c.id === modalityId);
  const track = category ? resolveModalityTrack(category) : undefined;
  const address = store.unit.address;
  return buildGraduationCertificate({
    promotionId: entry.id,
    studentId: client.id,
    modalityId,
    organizationName: store.organization.name,
    studentName: client.name,
    modalityName: category?.name ?? progression.modalityName ?? "",
    levelName: entry.toLevelName,
    previousLevelName: entry.fromLevelName,
    subLevel: entry.toSubLevel,
    beltStyle: resolveTrackStyle(track ?? undefined) === "belt",
    graduatedOn: entry.date,
    instructorName: entry.examiner?.trim() || teacherOfStudentIn(client.id, modalityId),
    city: typeof address === "object" ? address?.city : undefined,
    issuedOn: todayISO(),
  });
}

export function issuedGraduationCertificateOf(promotionId: Id): IssuedCertificate | undefined {
  return (store.issuedCertificates ?? []).find((c) => c.kind === "graduation" && c.promotionId === promotionId);
}

function issuedInfo(issued: IssuedCertificate): IssuedCertificateInfo {
  return { code: issued.code, status: issued.status, issuedAt: issued.issuedAt, canceledAt: issued.canceledAt };
}

/** Emite (1a vez) ou devolve o ja emitido. */
function issueFor(promotion: Promotion): IssuedCertificate {
  const existing = issuedGraduationCertificateOf(promotion.entry.id);
  if (existing) return existing;
  const certificate = certificateDataOf(promotion);
  const now = nowIso();
  const issued: IssuedCertificate = {
    id: newId(),
    organizationId: store.organization.id,
    kind: "graduation",
    promotionId: promotion.entry.id,
    modalityId: promotion.modalityId,
    studentId: promotion.client.id,
    code: newCertificateCode(),
    snapshot: certificate,
    status: "valid",
    issuedBy: getCurrentActor()?.userId,
    issuedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  if (!store.issuedCertificates) store.issuedCertificates = [];
  store.issuedCertificates.push(issued);
  auditLogService.record({
    action: "created",
    target: { type: "certificate", id: issued.id, label: issuedCertificateLabel(issued) },
    predicate: `emitiu o certificado de graduação de ${certificate.studentName} (${certificate.levelName} em ${certificate.modalityName}, código ${issued.code})`,
  });
  return issued;
}

function documentOf(issued: IssuedCertificate, modalityId: Id): GraduationCertificateDocument {
  return {
    certificate: { ...(issued.snapshot as GraduationCertificate), verificationCode: issued.code },
    issued: issuedInfo(issued),
    template: currentCertificateTemplate(modalityId, "graduation"),
  };
}

export const graduationCertificateService = {
  /**
   * Graduacoes registradas (as mais recentes primeiro), para a previa do editor
   * de modelos; o professor so ve os alunos das turmas dele. Sem gravar nada.
   */
  listGraduations(): Promise<GraduationOption[]> {
    return readOp(async () => {
      const options: GraduationOption[] = [];
      for (const client of store.clients) {
        if (!teacherTeachesStudent(client.id)) continue;
        for (const [modalityId, progression] of Object.entries(client.progressions ?? {})) {
          const modalityName = store.categories.find((c) => c.id === modalityId)?.name ?? progression.modalityName ?? "";
          for (const entry of progression.promotionHistory) {
            options.push({
              promotionId: entry.id,
              studentId: client.id,
              studentName: client.name,
              modalityName,
              levelName: entry.toLevelName,
              graduatedOn: entry.date,
            });
          }
        }
      }
      return clone(options.sort((a, b) => b.graduatedOn.localeCompare(a.graduatedOn) || a.studentName.localeCompare(b.studentName, "pt-BR")).slice(0, 100));
    });
  },

  /** Os dados de uma graduacao, como sairiam agora, para a previa do editor (sem emitir). */
  previewGraduationCertificate(studentId: Id, promotionId: Id): Promise<GraduationCertificate> {
    return readOp(async () => {
      const promotion = promotionOf(studentId, promotionId);
      assertCanManageProgression(studentId, { modalityId: promotion.modalityId });
      const issued = issuedGraduationCertificateOf(promotionId);
      return clone({ ...certificateDataOf(promotion), verificationCode: issued?.code ?? "GH-7K3M-2A9F" });
    });
  },

  /**
   * Certificado de graduacao de um registro do historico. Abrir pela 1a vez
   * EMITE (grava o codigo e os dados daquele momento); depois, o mesmo codigo.
   * Quem gere a evolucao do aluno emite (`assertCanManageProgression`).
   */
  getGraduationCertificate(studentId: Id, promotionId: Id): Promise<GraduationCertificateDocument> {
    return writeOp(async () => {
      assertFeature("certificates");
      const promotion = promotionOf(studentId, promotionId);
      assertCanManageProgression(studentId, { modalityId: promotion.modalityId });
      return clone(documentOf(issueFor(promotion), promotion.modalityId));
    });
  },

  /**
   * Certificados de quem graduou no evento de graduacao (doc product/30 §4),
   * para um PDF so, em ordem de nome. Emite quem ainda nao tinha; os
   * cancelados ficam de fora do PDF. Confere cada aluno como o individual.
   */
  issueEventGraduationCertificates(eventId: Id): Promise<EventGraduationCertificatesBatch> {
    return writeOp(async () => {
      assertFeature("certificates");
      const event = store.events?.find((e) => e.id === eventId);
      if (!event) throw notFoundError("Evento não encontrado.");
      const promotions: Promotion[] = [];
      for (const client of store.clients) {
        for (const [modalityId, progression] of Object.entries(client.progressions ?? {})) {
          for (const entry of progression.promotionHistory) {
            if (entry.eventId === eventId) promotions.push({ client, modalityId, progression, entry });
          }
        }
      }
      if (promotions.length === 0) throw notFoundError("Ninguém graduou neste evento ainda.");
      promotions.sort((a, b) => a.client.name.localeCompare(b.client.name, "pt-BR"));
      const items = promotions.map((promotion) => {
        assertCanManageProgression(promotion.client.id, { modalityId: promotion.modalityId });
        return documentOf(issueFor(promotion), promotion.modalityId);
      });
      return clone({ eventId: event.id, eventName: event.name, items });
    });
  },

  /** Cancela o certificado de graduacao emitido: a pagina publica passa a dizer que nao vale. */
  cancelGraduationCertificate(studentId: Id, promotionId: Id, reason?: string): Promise<IssuedCertificateInfo> {
    return writeOp(async () => {
      assertFeature("certificates");
      const promotion = promotionOf(studentId, promotionId);
      assertCanManageProgression(studentId, { modalityId: promotion.modalityId });
      const issued = issuedGraduationCertificateOf(promotionId);
      if (!issued) throw notFoundError("Certificado não emitido.");
      if (issued.status !== "canceled") {
        const now = nowIso();
        issued.status = "canceled";
        issued.canceledAt = now;
        issued.cancelReason = reason?.trim() || undefined;
        issued.updatedAt = now;
        auditLogService.record({
          action: "cancelled",
          target: { type: "certificate", id: issued.id, label: issuedCertificateLabel(issued) },
          predicate: `cancelou o certificado de graduação de ${promotion.client.name} (${promotion.entry.toLevelName}, código ${issued.code})`,
        });
      }
      return clone(issuedInfo(issued));
    });
  },
};
