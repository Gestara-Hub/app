import { assertTeacherSeesClass } from "./teacherScope";
import type { CourseCertificateDocument, Id } from "@gestarahub/contracts";
import { isCourseEnded } from "@gestarahub/core/billing";
import { buildCourseCertificate } from "@gestarahub/core/certificate";
import { apiError, notFoundError, readOp } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { currentCertificateTemplate } from "../settings/certificatesService";
import { assertFeature } from "../subscription/subscriptionService";
import { clone, todayISO, modalityName, instructorName, studentName } from "./classShared";
import { frequencyOf } from "./classViews";

export const courseCertificateService = {
  /**
   * Certificado de conclusao (doc 20, fase D; recurso pago `certificates`).
   * So para matricula ativa em curso ja terminado ("Concluído"). Devolve os
   * dados do aluno e o modelo do espaco (doc 21, secao 1).
   */
  getCourseCertificate(enrollmentId: Id): Promise<CourseCertificateDocument> {
    return readOp(async () => {
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
      // O modelo da modalidade do curso, se ela tem o proprio; senao o do espaco.
      return clone({ certificate, template: currentCertificateTemplate(g.modalityId) });
    });
  },
};
