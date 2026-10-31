import { assertTeacherSeesClass } from "./teacherScope";
import type { CourseCertificateDocument, Id, IssuedCertificate } from "@gestarahub/contracts";
import { isCourseEnded } from "@gestarahub/core/billing";
import { buildCourseCertificate, newCertificateCode } from "@gestarahub/core/certificate";
import { getCurrentActor } from "@/mocks/currentActor";
import { apiError, newId, notFoundError, nowIso, writeOp } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { auditLogService } from "../audit/auditLogService";
import { currentCertificateTemplate } from "../settings/certificatesService";
import { assertFeature } from "../subscription/subscriptionService";
import { clone, todayISO, modalityName, instructorName, studentName } from "./classShared";
import { frequencyOf } from "./classViews";

/** Certificados emitidos (doc 21 §1.3): nasce vazio no 1o certificado. */
function issuedStore(): IssuedCertificate[] {
  if (!store.issuedCertificates) store.issuedCertificates = [];
  return store.issuedCertificates;
}

export function issuedCertificateOf(enrollmentId: Id): IssuedCertificate | undefined {
  return (store.issuedCertificates ?? []).find((c) => c.enrollmentId === enrollmentId);
}

export const courseCertificateService = {
  /**
   * Certificado de conclusao (doc 20, fase D; recurso pago `certificates`).
   * So para matricula ativa em curso ja terminado ("Concluído"). Devolve os
   * dados do aluno e o modelo do espaco ou da modalidade (doc 21, secao 1).
   *
   * Abrir pela 1a vez EMITE: grava o registro com o codigo de verificacao e os
   * dados daquele momento (doc 21 §1.3). Nas proximas, o codigo e o mesmo. Por
   * isso e uma gravacao, nao uma leitura.
   */
  getCourseCertificate(enrollmentId: Id): Promise<CourseCertificateDocument> {
    return writeOp(async () => {
      assertFeature("certificates");
      const e = store.enrollments.find((x) => x.id === enrollmentId);
      if (!e || e.status === "canceled") throw notFoundError("Matrícula não encontrada.");
      const g = store.classGroups.find((x) => x.id === e.classGroupId);
      if (!g) throw notFoundError("Turma não encontrada.");
      // Professor: so o certificado do curso dele (revisao geral de 31/10/2026, achado S4).
      assertTeacherSeesClass(g, "Você só emite o certificado dos seus cursos.");
      if (!isCourseEnded(g, todayISO()) || !g.endDate) {
        throw apiError("VALIDATION", "O certificado sai quando o curso termina.", { httpStatus: 422 });
      }
      const address = store.unit.address;
      const { presentCount, absentCount } = frequencyOf(g.id, e.studentId);
      let issued = issuedCertificateOf(e.id);
      if (!issued) {
        const certificate = buildCourseCertificate({
          enrollmentId: e.id,
          classGroupId: g.id,
          organizationName: store.organization.name,
          studentName: studentName(e.studentId),
          courseName: g.name,
          modalityName: modalityName(g.modalityId),
          startDate: g.startDate,
          endDate: g.endDate,
          meetingSlots: g.meetingSlots,
          presentCount,
          absentCount,
          instructorName: instructorName(g.instructorId),
          city: typeof address === "object" ? address?.city : undefined,
          issuedOn: todayISO(),
        });
        const now = nowIso();
        issued = {
          id: newId(),
          organizationId: store.organization.id,
          enrollmentId: e.id,
          classGroupId: g.id,
          studentId: e.studentId,
          code: newCertificateCode(),
          snapshot: certificate,
          status: "valid",
          issuedBy: getCurrentActor()?.userId,
          issuedAt: now,
          createdAt: now,
          updatedAt: now,
        };
        issuedStore().push(issued);
        auditLogService.record({
          action: "created",
          target: { type: "certificate", id: issued.id, label: `${certificate.studentName} · ${certificate.courseName}` },
          predicate: `emitiu o certificado de ${certificate.studentName} em ${certificate.courseName} (código ${issued.code})`,
        });
      }
      return clone({
        certificate: { ...issued.snapshot, verificationCode: issued.code },
        template: currentCertificateTemplate(g.modalityId),
        issued: { code: issued.code, status: issued.status, issuedAt: issued.issuedAt, canceledAt: issued.canceledAt },
      });
    });
  },

  /** Cancela o certificado emitido (emissao errada): a pagina publica passa a dizer que nao vale. */
  cancelCertificate(enrollmentId: Id, reason?: string): Promise<CourseCertificateDocument["issued"]> {
    return writeOp(async () => {
      assertFeature("certificates");
      const issued = issuedCertificateOf(enrollmentId);
      if (!issued) throw notFoundError("Certificado não emitido.");
      const g = store.classGroups.find((x) => x.id === issued.classGroupId);
      if (g) assertTeacherSeesClass(g, "Você só cancela o certificado dos seus cursos.");
      if (issued.status !== "canceled") {
        const now = nowIso();
        issued.status = "canceled";
        issued.canceledAt = now;
        issued.cancelReason = reason?.trim() || undefined;
        issued.updatedAt = now;
        auditLogService.record({
          action: "cancelled",
          target: { type: "certificate", id: issued.id, label: `${issued.snapshot.studentName} · ${issued.snapshot.courseName}` },
          predicate: `cancelou o certificado de ${issued.snapshot.studentName} em ${issued.snapshot.courseName} (código ${issued.code})`,
        });
      }
      return clone({ code: issued.code, status: issued.status, issuedAt: issued.issuedAt, canceledAt: issued.canceledAt });
    });
  },
};
