import type { DateTimeISO, Id } from "./common";
import type { CourseCertificate } from "./class";

/**
 * Certificado emitido (doc 21 §1.3): o registro da emissao, com o codigo de
 * verificacao que vai no rodape e abre a pagina publica. Uma matricula tem no
 * maximo um; cancelado, a pagina diz que nao vale.
 */
export type IssuedCertificateStatus = "valid" | "canceled";

export interface IssuedCertificate {
  id: Id;
  organizationId: Id;
  enrollmentId: Id;
  classGroupId: Id;
  studentId: Id;
  /** Codigo curto, ex.: "GH-7K3M-2A9F". */
  code: string;
  /** Os dados do certificado no momento da emissao. */
  snapshot: CourseCertificate;
  status: IssuedCertificateStatus;
  issuedBy?: Id;
  issuedAt: DateTimeISO;
  canceledAt?: DateTimeISO;
  cancelReason?: string;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

/** O que a pagina publica mostra: so dados mascarados e nada que identifique o aluno. */
export interface CertificateVerification {
  code: string;
  status: IssuedCertificateStatus;
  /** "Ana S." */
  studentName: string;
  courseName: string;
  modalityName?: string;
  organizationName: string;
  startDate: string;
  endDate: string;
  lessonsCount: number;
  workloadMinutes: number;
  attendancePercent: number | null;
  issuedOn: string;
}
