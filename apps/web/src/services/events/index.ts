import { delegateAll } from "../world/delegate";
import { eventAttendanceService } from "./eventAttendanceService";
import { eventRegistrationsService } from "./eventRegistrationsService";
import { eventsService as eventsCore } from "./eventsService";

// Eventos e seminarios (doc product/29): modulo proprio, fora das turmas.
export { eventAttendanceService, eventRegistrationsService };

export const eventsServiceImpl = {
  ...eventsCore,
  ...eventRegistrationsService,
  ...eventAttendanceService,
};

/** Conta real no navegador: roda no servidor sobre o banco (doc 15, fatia 2). */
export const eventsService = delegateAll("events", eventsServiceImpl);
