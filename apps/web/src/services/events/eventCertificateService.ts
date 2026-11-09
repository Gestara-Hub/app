import type {
  CertificateTemplate,
  CourseCertificate,
  CourseCertificateDocument,
  Event,
  EventCertificateDocument,
  EventCertificatesBatch,
  EventRegistration,
  Id,
  IssuedCertificate,
} from "@gestarahub/contracts";
import {
  CERTIFICATE_PRESETS,
  DEFAULT_CERTIFICATE_BODY,
  DEFAULT_CERTIFICATE_TITLE,
  DEFAULT_EVENT_CERTIFICATE_BODY,
  DEFAULT_EVENT_CERTIFICATE_TITLE,
  newCertificateCode,
} from "@gestarahub/core/certificate";
import { activeDays, eventStage, eventTotalHours } from "@gestarahub/core/events";
import { getCurrentActor } from "@/services/world/actor";
import { apiError, newId, notFoundError, nowIso, readOp, writeOp } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { auditLogService } from "../audit/auditLogService";
import { currentCertificateTemplate } from "../settings/certificatesService";
import { assertFeature } from "../subscription/subscriptionService";
import {
  assertTeacherSeesEvent,
  clone,
  conductorName,
  confirmedRegistrations,
  eventAttendancesStore,
  findEvent,
  findRegistration,
  modalityName,
  sessionsOf,
  studentName,
  todayISO,
} from "./eventShared";

/**
 * Certificado de participacao em evento (doc product/29, fase 5; recurso pago
 * `certificates`). Mesma folha, modelo e codigo de verificacao do certificado
 * de curso (doc 21 §1.3): o snapshot e um `CourseCertificate` com o nome do
 * evento em `courseName`, a inscricao em `enrollmentId` e o evento em
 * `classGroupId`. Sai para quem esteve presente em ao menos um dia, depois
 * que o evento termina. Abrir pela 1a vez EMITE.
 */

function issuedStore(): IssuedCertificate[] {
  if (!store.issuedCertificates) store.issuedCertificates = [];
  return store.issuedCertificates;
}

export function issuedEventCertificateOf(registrationId: Id): IssuedCertificate | undefined {
  return (store.issuedCertificates ?? []).find((c) => c.kind === "event" && c.eventRegistrationId === registrationId);
}

/** Dias feitos do evento (nao cancelados, com data ate hoje). */
function doneDays(event: Event) {
  const today = todayISO();
  return activeDays(sessionsOf(event.id)).filter((d) => d.date <= today);
}

function presentCount(registrationId: Id): number {
  return eventAttendancesStore().filter((a) => a.registrationId === registrationId && a.status === "present").length;
}

/** Os dados do certificado da inscricao, como sairiam agora (sem emitir). */
function certificateDataOf(registration: EventRegistration, event: Event): CourseCertificate {
  const days = activeDays(sessionsOf(event.id));
  const covered = registration.scope === "days" ? days.filter((d) => (registration.sessionIds ?? []).includes(d.id)) : days;
  const present = presentCount(registration.id);
  const address = store.unit.address;
  const city = typeof address === "object" ? address?.city?.trim() : undefined;
  const totalMinutes = Math.round(eventTotalHours(covered) * 60);
  return {
    enrollmentId: registration.id,
    classGroupId: event.id,
    organizationName: store.organization.name.trim(),
    studentName: studentName(registration.studentId).trim(),
    courseName: event.name.trim(),
    ...(modalityName(event.modalityId) ? { modalityName: modalityName(event.modalityId) } : {}),
    startDate: covered[0]?.date ?? todayISO(),
    endDate: covered[covered.length - 1]?.date ?? todayISO(),
    lessonsCount: covered.length,
    workloadMinutes: totalMinutes,
    attendancePercent: covered.length > 0 ? Math.round((Math.min(present, covered.length) / covered.length) * 100) : null,
    instructorName: conductorName(event).trim(),
    ...(city ? { city } : {}),
    issuedOn: todayISO(),
  };
}

/**
 * Modelo do espaco (ou da modalidade), com titulo e texto de participacao
 * quando o espaco ainda usa o padrao ou um modelo pronto; texto editado fica.
 */
function eventTemplate(event: Event): CertificateTemplate {
  const template = currentCertificateTemplate(event.modalityId);
  const presetBodies = new Set(Object.values(CERTIFICATE_PRESETS).map((p) => p.body));
  const presetTitles = new Set(Object.values(CERTIFICATE_PRESETS).map((p) => p.title));
  if (template.title === DEFAULT_CERTIFICATE_TITLE || presetTitles.has(template.title)) template.title = DEFAULT_EVENT_CERTIFICATE_TITLE;
  if (template.body === DEFAULT_CERTIFICATE_BODY || presetBodies.has(template.body)) template.body = DEFAULT_EVENT_CERTIFICATE_BODY;
  return template;
}

/** Evento terminado que o professor ve; senao, o erro certo. */
function endedEventOf(eventId: Id): Event {
  const event = findEvent(eventId);
  assertTeacherSeesEvent(event, "Você só emite o certificado dos eventos que conduz.");
  if (event.status === "canceled") throw apiError("VALIDATION", "Este evento foi cancelado.", { httpStatus: 409 });
  if (eventStage(sessionsOf(event.id), todayISO()) !== "finished") {
    throw apiError("VALIDATION", "O certificado sai quando o evento termina.", { httpStatus: 422 });
  }
  return event;
}

/** Inscricao confirmada e presente em ao menos um dia. */
function assertParticipated(registration: EventRegistration): void {
  if (registration.status !== "confirmed") throw notFoundError("Inscrição não encontrada.");
  if (presentCount(registration.id) === 0) {
    throw apiError("VALIDATION", `${studentName(registration.studentId)} não teve presença no evento.`, { httpStatus: 422 });
  }
}

function issueFor(registration: EventRegistration, event: Event): IssuedCertificate {
  const existing = issuedEventCertificateOf(registration.id);
  if (existing) return existing;
  const certificate = certificateDataOf(registration, event);
  const now = nowIso();
  const issued: IssuedCertificate = {
    id: newId(),
    organizationId: store.organization.id,
    kind: "event",
    eventRegistrationId: registration.id,
    eventId: event.id,
    studentId: registration.studentId,
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
    target: { type: "certificate", id: issued.id, label: `${certificate.studentName} · ${event.name}` },
    predicate: `emitiu o certificado de participação de ${certificate.studentName} em ${event.name} (código ${issued.code})`,
  });
  return issued;
}

function documentOf(issued: IssuedCertificate): Omit<CourseCertificateDocument, "template"> {
  return {
    certificate: { ...(issued.snapshot as CourseCertificate), verificationCode: issued.code },
    issued: { code: issued.code, status: issued.status, issuedAt: issued.issuedAt, canceledAt: issued.canceledAt },
  };
}

export const eventCertificateService = {
  /** Inscritos que podem receber o certificado (evento terminado, presenca em algum dia). */
  listEventCertificateCandidates(eventId: Id): Promise<{ registrationId: Id; studentName: string; issuedCode?: string }[]> {
    return readOp(async () => {
      const event = findEvent(eventId);
      assertTeacherSeesEvent(event);
      if (doneDays(event).length === 0) return [];
      return clone(
        confirmedRegistrations(eventId)
          .filter((r) => presentCount(r.id) > 0)
          .map((r) => ({ registrationId: r.id, studentName: studentName(r.studentId), issuedCode: issuedEventCertificateOf(r.id)?.code }))
          .sort((a, b) => a.studentName.localeCompare(b.studentName, "pt-BR")),
      );
    });
  },

  /** Certificado de um inscrito: abrir pela 1a vez emite (grava o codigo). */
  getEventCertificate(registrationId: Id): Promise<EventCertificateDocument> {
    return writeOp(async () => {
      assertFeature("certificates");
      const registration = findRegistration(registrationId);
      const event = endedEventOf(registration.eventId);
      assertParticipated(registration);
      const issued = issueFor(registration, event);
      return clone({ ...documentOf(issued), template: eventTemplate(event) });
    });
  },

  /** Emite em lote: todos os inscritos com presenca, na ordem do nome. */
  issueEventCertificates(eventId: Id): Promise<EventCertificatesBatch> {
    return writeOp(async () => {
      assertFeature("certificates");
      const event = endedEventOf(eventId);
      const items = confirmedRegistrations(eventId)
        .filter((r) => presentCount(r.id) > 0)
        .map((r) => ({ r, name: studentName(r.studentId) }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        .map(({ r }) => documentOf(issueFor(r, event)));
      return clone({ eventId: event.id, eventName: event.name, template: eventTemplate(event), items });
    });
  },

  /** Cancela o certificado emitido (emissao errada): a pagina publica passa a dizer que nao vale. */
  cancelEventCertificate(registrationId: Id, reason?: string): Promise<CourseCertificateDocument["issued"]> {
    return writeOp(async () => {
      assertFeature("certificates");
      const issued = issuedEventCertificateOf(registrationId);
      if (!issued) throw notFoundError("Certificado não emitido.");
      const event = issued.eventId ? store.events?.find((e) => e.id === issued.eventId) : undefined;
      if (event) assertTeacherSeesEvent(event, "Você só cancela o certificado dos eventos que conduz.");
      if (issued.status !== "canceled") {
        const now = nowIso();
        issued.status = "canceled";
        issued.canceledAt = now;
        issued.cancelReason = reason?.trim() || undefined;
        issued.updatedAt = now;
        const snapshot = issued.snapshot as CourseCertificate;
        auditLogService.record({
          action: "cancelled",
          target: { type: "certificate", id: issued.id, label: `${snapshot.studentName} · ${snapshot.courseName}` },
          predicate: `cancelou o certificado de participação de ${snapshot.studentName} em ${snapshot.courseName} (código ${issued.code})`,
        });
      }
      return clone({ code: issued.code, status: issued.status, issuedAt: issued.issuedAt, canceledAt: issued.canceledAt });
    });
  },
};
