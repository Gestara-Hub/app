import { assertTeacherSeesClass, teacherSeesClass } from "./teacherScope";
import type {
  CompletedEnrollmentOption,
  CourseCertificate,
  CourseCertificateDocument,
  CourseCertificatesBatch,
  Id,
  IssuedCertificate,
} from "@gestarahub/contracts";
import { isCourseEnded } from "@gestarahub/core/billing";
import { buildCourseCertificate, newCertificateCode } from "@gestarahub/core/certificate";
import { getCurrentActor } from "@/mocks/currentActor";
import { apiError, newId, notFoundError, nowIso, readOp, writeOp } from "@/services/world/ops";
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

type Enrollment = (typeof store.enrollments)[number];
type ClassGroup = (typeof store.classGroups)[number];

/** Os dados do certificado de uma matricula, como sairiam agora (sem emitir). */
function certificateDataOf(e: Enrollment, g: ClassGroup & { endDate: string }): CourseCertificate {
  const address = store.unit.address;
  const { presentCount, absentCount } = frequencyOf(g.id, e.studentId);
  return buildCourseCertificate({
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
}

/** Emite (1a vez) ou devolve o ja emitido; a turma ja foi conferida por quem chama. */
function issueFor(e: Enrollment, g: ClassGroup & { endDate: string }): IssuedCertificate {
  const existing = issuedCertificateOf(e.id);
  if (existing) return existing;
  const certificate = certificateDataOf(e, g);
  const now = nowIso();
  const issued: IssuedCertificate = {
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
  return issued;
}

function documentOf(issued: IssuedCertificate): Omit<CourseCertificateDocument, "template"> {
  return {
    certificate: { ...issued.snapshot, verificationCode: issued.code },
    issued: { code: issued.code, status: issued.status, issuedAt: issued.issuedAt, canceledAt: issued.canceledAt },
  };
}

/** Turma de curso ja terminada, que o professor ve; senao, o erro certo. */
function endedCourseOf(classGroupId: Id): ClassGroup & { endDate: string } {
  const g = store.classGroups.find((x) => x.id === classGroupId);
  if (!g) throw notFoundError("Turma não encontrada.");
  assertTeacherSeesClass(g, "Você só emite o certificado dos seus cursos.");
  if (!isCourseEnded(g, todayISO()) || !g.endDate) {
    throw apiError("VALIDATION", "O certificado sai quando o curso termina.", { httpStatus: 422 });
  }
  return g as ClassGroup & { endDate: string };
}

export const courseCertificateService = {
  /**
   * Alunos concluidos (matricula ativa em curso terminado) para a previa do
   * editor de modelos; o professor so ve os cursos dele. Sem gravar nada.
   */
  listCompletedEnrollments(): Promise<CompletedEnrollmentOption[]> {
    return readOp(async () => {
      const today = todayISO();
      const options: CompletedEnrollmentOption[] = [];
      for (const g of store.classGroups) {
        if (!g.endDate || !isCourseEnded(g, today) || !teacherSeesClass(g)) continue;
        for (const e of store.enrollments) {
          if (e.classGroupId !== g.id || e.status !== "active") continue;
          options.push({ enrollmentId: e.id, studentName: studentName(e.studentId), courseName: g.name });
        }
      }
      return clone(options.sort((a, b) => a.courseName.localeCompare(b.courseName, "pt-BR") || a.studentName.localeCompare(b.studentName, "pt-BR")));
    });
  },

  /** Os dados do certificado de um aluno, como sairiam agora, para a previa do editor (sem emitir). */
  previewCourseCertificate(enrollmentId: Id): Promise<CourseCertificate> {
    return readOp(async () => {
      const e = store.enrollments.find((x) => x.id === enrollmentId);
      if (!e || e.status === "canceled") throw notFoundError("Matrícula não encontrada.");
      const g = endedCourseOf(e.classGroupId);
      const issued = issuedCertificateOf(e.id);
      return clone({ ...certificateDataOf(e, g), verificationCode: issued?.code ?? "GH-7K3M-2A9F" });
    });
  },

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
      const g = endedCourseOf(e.classGroupId);
      const issued = issueFor(e, g);
      return clone({ ...documentOf(issued), template: currentCertificateTemplate(g.modalityId) });
    });
  },

  /**
   * Emite em lote (doc 21 §1.4): todos os alunos com matricula ativa do curso
   * terminado, na ordem da lista. Quem ja tinha certificado fica com o mesmo
   * codigo. Devolve os certificados (cancelados inclusos, para a lista) e o modelo.
   */
  issueCourseCertificates(classGroupId: Id): Promise<CourseCertificatesBatch> {
    return writeOp(async () => {
      assertFeature("certificates");
      const g = endedCourseOf(classGroupId);
      const enrollments = store.enrollments
        .filter((e) => e.classGroupId === g.id && e.status === "active")
        .map((e) => ({ e, name: studentName(e.studentId) }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      const items = enrollments.map(({ e }) => documentOf(issueFor(e, g)));
      return clone({ classGroupId: g.id, className: g.name, template: currentCertificateTemplate(g.modalityId), items });
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
