import { delegateAll } from "../world/delegate";
import { eventAttendanceService } from "./eventAttendanceService";
import { eventCertificateService } from "./eventCertificateService";
import { eventCheckInService } from "./eventCheckInService";
import { eventRegistrationsService } from "./eventRegistrationsService";
import { eventsService as eventsCore } from "./eventsService";

// Eventos e seminarios (doc product/29): modulo proprio, fora das turmas.
export { eventAttendanceService, eventCertificateService, eventRegistrationsService };

export const eventsServiceImpl = {
  ...eventsCore,
  ...eventRegistrationsService,
  ...eventAttendanceService,
  ...eventCertificateService,
  ...eventCheckInService,
};

/** Conta real no navegador: roda no servidor sobre o banco (doc 15, fatia 2). */
export const eventsService = delegateAll("events", eventsServiceImpl);
