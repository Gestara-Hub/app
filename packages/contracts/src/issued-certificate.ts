import type { DateTimeISO, Id } from "./common";
import type { CourseCertificate } from "./class";
import type { CertificateKind, GraduationCertificate } from "./certificate";

/**
 * Certificado emitido (doc 21 §1.3): o registro da emissao, com o codigo de
 * verificacao que vai no rodape e abre a pagina publica. Uma matricula tem no
 * maximo um; cancelado, a pagina diz que nao vale.
 */
export type IssuedCertificateStatus = "valid" | "canceled";

export interface IssuedCertificate {
  id: Id;
  organizationId: Id;
  /** Ausente = certificado de curso (doc 21 §1.6). */
  kind?: CertificateKind;
  /** So no certificado de curso. */
  enrollmentId?: Id;
  classGroupId?: Id;
  /** So no certificado de graduacao: o registro no historico do aluno e a modalidade. */
  promotionId?: Id;
  modalityId?: Id;
  studentId: Id;
  /** Codigo curto, ex.: "GH-7K3M-2A9F". */
  code: string;
  /** Os dados do certificado no momento da emissao (curso ou graduacao, conforme `kind`). */
  snapshot: CourseCertificate | GraduationCertificate;
  status: IssuedCertificateStatus;
  issuedBy?: Id;
  issuedAt: DateTimeISO;
  canceledAt?: DateTimeISO;
  cancelReason?: string;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

/** O que a pagina publica mostra: so dados mascarados e nada que identifique o aluno. */
interface CertificateVerificationBase {
  code: string;
  status: IssuedCertificateStatus;
  /** "Ana S." */
  studentName: string;
  modalityName?: string;
  organizationName: string;
  issuedOn: string;
}

export interface CourseCertificateVerification extends CertificateVerificationBase {
  kind: "course";
  courseName: string;
  startDate: string;
  endDate: string;
  lessonsCount: number;
  workloadMinutes: number;
  attendancePercent: number | null;
}

export interface GraduationCertificateVerification extends CertificateVerificationBase {
  kind: "graduation";
  levelName: string;
  previousLevelName?: string;
  graduatedOn: string;
}

export type CertificateVerification = CourseCertificateVerification | GraduationCertificateVerification;
