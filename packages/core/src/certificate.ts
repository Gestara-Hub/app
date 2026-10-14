import { eachDayOfInterval, format, getDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CourseCertificate, DateISO, Id } from "@gestarahub/contracts";

/**
 * Certificado de conclusao do curso (doc 20, fase D). Duas partes separadas:
 * os DADOS (`buildCourseCertificate`, o que a API devolve) e o TEXTO do modelo
 * padrao (`defaultCertificateText`). Um futuro gerador de certificados troca so
 * o texto e o desenho, sem mexer nos dados.
 */

const brDate = (iso: DateISO) => format(parseISO(iso), "dd/MM/yyyy");

/**
 * Aulas do curso: cada encontro semanal entre o inicio e o fim, inclusive
 * (dois encontros no mesmo dia da semana contam dois). Fim antes do inicio = 0.
 */
export function countCourseLessons(startDate: DateISO, endDate: DateISO, weekdays: readonly number[]): number {
  if (endDate < startDate || weekdays.length === 0) return 0;
  return eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) }).reduce(
    (sum, day) => sum + weekdays.filter((w) => w === getDay(day)).length,
    0,
  );
}

/** Frequencia em % inteiro: presencas / (presencas + faltas). Sem chamada = null. */
export function attendancePercent(present: number, absent: number): number | null {
  const total = present + absent;
  return total > 0 ? Math.round((present / total) * 100) : null;
}

export interface CourseCertificateInput {
  enrollmentId: Id;
  classGroupId: Id;
  organizationName: string;
  studentName: string;
  courseName: string;
  modalityName?: string;
  startDate: DateISO;
  endDate: DateISO;
  /** Dia da semana de cada encontro (0 = domingo). */
  meetingWeekdays: readonly number[];
  presentCount: number;
  absentCount: number;
  instructorName: string;
  city?: string;
  issuedOn: DateISO;
}

export function buildCourseCertificate(input: CourseCertificateInput): CourseCertificate {
  const city = input.city?.trim();
  return {
    enrollmentId: input.enrollmentId,
    classGroupId: input.classGroupId,
    organizationName: input.organizationName.trim(),
    studentName: input.studentName.trim(),
    courseName: input.courseName.trim(),
    ...(input.modalityName ? { modalityName: input.modalityName } : {}),
    startDate: input.startDate,
    endDate: input.endDate,
    lessonsCount: countCourseLessons(input.startDate, input.endDate, input.meetingWeekdays),
    attendancePercent: attendancePercent(input.presentCount, input.absentCount),
    instructorName: input.instructorName.trim(),
    ...(city ? { city } : {}),
    issuedOn: input.issuedOn,
  };
}

export interface CertificateText {
  title: string;
  body: string;
  /** "São Paulo, 14 de outubro de 2026" (sem cidade, so a data). */
  placeAndDate: string;
}

/** Texto do modelo padrao. */
export function defaultCertificateText(cert: CourseCertificate): CertificateText {
  const period =
    cert.startDate === cert.endDate
      ? `em ${brDate(cert.startDate)}`
      : `de ${brDate(cert.startDate)} a ${brDate(cert.endDate)}`;
  const lessons = `${cert.lessonsCount} ${cert.lessonsCount === 1 ? "aula" : "aulas"}`;
  const attendance = cert.attendancePercent === null ? "" : ` e frequência de ${cert.attendancePercent}%`;
  const date = format(parseISO(cert.issuedOn), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  return {
    title: "Certificado de conclusão",
    body: `Certificamos que ${cert.studentName} concluiu o curso ${cert.courseName}, ${period}, com ${lessons}${attendance}.`,
    placeAndDate: cert.city ? `${cert.city}, ${date}` : date,
  };
}
