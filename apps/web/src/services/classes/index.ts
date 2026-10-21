import { attendanceService } from "./attendanceService";
import { classGroupsService } from "./classGroupsService";
import { classSessionsService } from "./classSessionsService";
import { courseCertificateService } from "./courseCertificateService";
import { enrollmentsService } from "./enrollmentsService";
import { reservationsService } from "./reservationsService";
import { sessionOverridesService } from "./sessionOverridesService";
import { waitlistService } from "./waitlistService";
import { delegateAll } from "../world/delegate";

// Sub-servicos por subdominio (doc 12, fase 1). Codigo novo importa daqui.
export {
  attendanceService,
  classGroupsService,
  classSessionsService,
  courseCertificateService,
  enrollmentsService,
  reservationsService,
  sessionOverridesService,
  waitlistService,
};
export { sessionDetailOf, sessionsOfClass } from "./classViews";
export type { ClassSessionListItem } from "./classViews";

// Fachada retrocompativel: quem ja importa turmasService segue igual.
export const turmasServiceImpl = {
  ...classGroupsService,
  ...enrollmentsService,
  ...courseCertificateService,
  ...classSessionsService,
  ...attendanceService,
  ...sessionOverridesService,
  ...waitlistService,
  ...reservationsService,
};

/** Conta real no navegador: roda no servidor sobre o banco (doc 15, fatia 2). */
export const turmasService = delegateAll("turmas", turmasServiceImpl);
