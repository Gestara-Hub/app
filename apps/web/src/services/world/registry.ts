import type { Permission } from "@gestarahub/contracts";
import type { MethodSlice } from "./slices";

/**
 * Metodos de servico que a conta real roda no servidor (doc 15, fatia 2), com
 * a permissao exigida alem das regras do proprio servico e do RLS. Importa os
 * servicos sob demanda para nao fechar ciclo com quem delega.
 */

type ServiceObject = Record<string, (...args: never[]) => Promise<unknown>>;

interface ServiceNamespace {
  load: () => Promise<ServiceObject>;
  /** Permissao por metodo (negacao por padrao: metodo ausente e bloqueado). Use AUTHENTICATED para leituras compartilhadas por todo usuario autenticado do espaco. */
  permissions: Record<string, Permission[]>;
  /** Metodos que nao vao para o servidor (arquivo, navegador). */
  browserOnly?: string[];
  /** Metodos com efeito externo antes da gravacao: nao repetem em conflito. */
  noRetry?: string[];
  /** Recorte por metodo (doc 19, fase 2): carrega so o que o metodo le. */
  slices?: () => Promise<Record<string, MethodSlice>>;
}

/** Qualquer membro autenticado do espaco (exclusivo para dados estruturais da sessao). */
const AUTHENTICATED: Permission[] = [];
const MANAGE_CLIENTS: Permission[] = ["clients:manage"];
const VIEW_CLIENTS: Permission[] = ["clients:view", "clients:view_own", "classes:view", "events:view", "billing:view", "communication:view"];
const MANAGE_CLASSES: Permission[] = ["classes:manage"];
const VIEW_CLASSES: Permission[] = ["classes:view", "classes:manage", "events:view", "clients:view", "clients:view_own", "communication:view", "dashboard:view"];
const MANAGE_ENROLLMENT: Permission[] = ["enrollment:manage"];
const MARK_ATTENDANCE: Permission[] = ["attendance:mark"];
const VIEW_BILLING: Permission[] = ["billing:view"];
const MANAGE_BILLING: Permission[] = ["billing:manage"];
const VIEW_FINANCE: Permission[] = ["finance:view"];
const MANAGE_FINANCE: Permission[] = ["finance:manage"];
const MANAGE_GRADES: Permission[] = ["grades:manage"];
const MANAGE_PROGRESSION: Permission[] = ["progression:manage"];
const VIEW_COMMUNICATION: Permission[] = ["communication:view"];
const MANAGE_COMMUNICATION: Permission[] = ["communication:manage"];

function all(methods: string[], permissions: Permission[]): Record<string, Permission[]> {
  return Object.fromEntries(methods.map((m) => [m, permissions]));
}

export const SERVICE_NAMESPACES: Record<string, ServiceNamespace> = {
  clients: {
    load: async () => (await import("../clients")).clientsServiceImpl as unknown as ServiceObject,
    slices: async () => (await import("../clients/clientSlices")).clientSlices,
    permissions: {
      ...all(["list", "listOptions", "listByIds", "listPaginated", "listVisitorIds", "listTrials", "getById"], VIEW_CLIENTS),
      getProgressionOverview: ["clients:view", "clients:view_own", "progression:manage"],
      listGraduations: ["progression:manage", "classes:manage", "clients:view", "clients:view_own"],
      previewGraduationCertificate: ["progression:manage", "classes:manage"],
      ...all(["getGraduationCertificate", "issueEventGraduationCertificates", "cancelGraduationCertificate"], MANAGE_PROGRESSION),
      ...all(
        [
          "addClassRecord",
          "addClassRecords",
          "updateStrengths",
          "addGoal",
          "setGoalCompleted",
          "removeGoal",
          "promoteStudent",
          "saveModalityProgression",
          "listPromotionCandidates",
          "promoteStudents",
          "getProgressionTermSuggestions",
        ],
        MANAGE_PROGRESSION,
      ),
      ...all(["create", "update", "remove"], MANAGE_CLIENTS),
    },
  },
  turmas: {
    load: async () => (await import("../classes")).turmasServiceImpl as unknown as ServiceObject,
    slices: async () => (await import("../classes/classSlices")).classSlices,
    permissions: {
      ...all(
        ["list", "getById", "listSessions", "getSession", "listEnrollments", "listEnrolledModalities", "listWaitlist", "getAttendanceSummary", "listAbsenceStreaks"],
        VIEW_CLASSES,
      ),
      ...all(["listCompletedEnrollments", "previewCourseCertificate", "getCourseCertificate", "issueCourseCertificates"], ["classes:view", "classes:manage"]),
      ...all(["create", "update", "deactivate", "reactivate", "substituteInstructor", "restorePrimaryInstructor"], MANAGE_CLASSES),
      // Cancelar um certificado emitido (doc 21 §1.3): quem gere as turmas.
      ...all(["cancelCertificate"], MANAGE_CLASSES),
      ...all(
        [
          "enroll",
          "setEnrollmentPayment",
          "cancelEnrollment",
          "moveStudents",
          "addToWaitlist",
          "promoteFromWaitlist",
          "removeFromWaitlist",
          "reserveSession",
          "cancelReservation",
        ],
        MANAGE_ENROLLMENT,
      ),
      ...all(["markAttendance", "markManyAttendance", "clearAttendance", "saveAttendance"], MARK_ATTENDANCE),
    },
  },
  // Eventos e seminarios (doc product/29): gerir pede events:manage; inscrever
  // e promover usam enrollment:manage e a chamada do dia, attendance:mark.
  events: {
    load: async () => (await import("../events")).eventsServiceImpl as unknown as ServiceObject,
    slices: async () => (await import("../events/eventSlices")).eventSlices,
    permissions: {
      ...all(["list", "getById", "listSessions", "getSessionDetail", "listRegistrations"], ["events:view"]),
      // Dinheiro do evento: quem ve cobrancas.
      getEventFinance: VIEW_BILLING,
      // Certificado de participacao (Pro): quem ve o evento emite (o professor so o dele); cancelar e de quem gere.
      ...all(["listEventCertificateCandidates", "getEventCertificate", "issueEventCertificates"], ["events:view"]),
      cancelEventCertificate: ["events:manage"],
      ...all(["create", "update", "cancelSession", "cancelEvent"], ["events:manage"]),
      ...all(["register", "promoteFromWaitlist", "cancelRegistration"], MANAGE_ENROLLMENT),
      ...all(["markEventAttendance", "markManyEventAttendance", "clearEventAttendance", "checkInTicket", "undoCheckIn", "getCheckInList", "syncOfflineCheckIns"], MARK_ATTENDANCE),
    },
  },
  billing: {
    load: async () => (await import("../billing")).billingServiceImpl as unknown as ServiceObject,
    slices: async () => (await import("../billing/billingSlices")).billingSlices,
    permissions: {
      ...all(["listCharges", "listChargesPaginated", "listOverdueStudentIds"], VIEW_BILLING),
      ...all(
        ["generateCharges", "createExtraCharge", "markPaid", "markPending", "cancelCharge", "reopenCharge"],
        MANAGE_BILLING,
      ),
    },
    // clearCharges: so a demonstracao e os testes. Na conta real apagava as
    // mensalidades em aberto e, em cascata, os Pix delas, que seguiam valendo no Asaas.
    browserOnly: ["listPlans", "createPlan", "updatePlan", "clearCharges"],
  },
  packages: {
    load: async () => (await import("../billing")).packagesServiceImpl as unknown as ServiceObject,
    slices: async () => (await import("../billing/packageSlices")).packageSlices,
    permissions: {
      listStudentPackages: VIEW_BILLING,
      ...all(["sellPackage", "cancelStudentPackage"], MANAGE_BILLING),
    },
    browserOnly: ["listPackages", "createPackage", "updatePackage"],
  },
  finance: {
    load: async () => (await import("../finance")).financeServiceImpl as unknown as ServiceObject,
    slices: async () => (await import("../finance/financeSlices")).financeSlices,
    permissions: {
      ...all(["getSummary", "getMonthlySeries", "getByCategory", "getUpcoming", "listEntries", "listCategories"], VIEW_FINANCE),
      ...all(
        ["createEntry", "updateEntry", "deleteEntry", "markEntryPaid", "markEntryPending", "cancelEntry", "endRecurrence", "createCategory", "updateCategory", "applyRecurringAutoPayments"],
        MANAGE_FINANCE,
      ),
    },
  },
  teacherPay: {
    load: async () => (await import("../finance")).teacherPayServiceImpl as unknown as ServiceObject,
    slices: async () => (await import("../finance/financeSlices")).teacherPaySlices,
    permissions: {
      ...all(["listTeachers", "listRules", "listPayouts", "getPayoutPreview"], VIEW_FINANCE),
      ...all(["saveRule", "saveAdjustments", "closePayout", "reopenPayout", "markPayoutPaid", "markPayoutUnpaid"], MANAGE_FINANCE),
    },
  },
  grades: {
    load: async () => (await import("../grades")).gradesServiceImpl as unknown as ServiceObject,
    slices: async () => (await import("../grades/gradeSlices")).gradeSlices,
    permissions: {
      ...all(["listClassAssessments", "getSheet", "getReportCard"], ["grades:manage", "classes:view", "clients:view", "clients:view_own"]),
      ...all(["create", "update", "remove", "setGrades"], MANAGE_GRADES),
    },
  },
  measurements: {
    load: async () => (await import("../measurements")).measurementsServiceImpl as unknown as ServiceObject,
    slices: async () => (await import("../measurements/measurementSlices")).measurementSlices,
    permissions: {
      getStudentMeasurements: ["progression:manage", "clients:view", "clients:view_own"],
      ...all(["create", "update", "remove"], MANAGE_PROGRESSION),
    },
  },
  // Documentos da ficha (doc product/28): a permissao depende do dono (aluno ou
  // instrutor) e o servico confere; aqui so barra quem nao ve nenhum dos dois.
  personDocuments: {
    load: async () => (await import("../personDocuments")).personDocumentsServiceImpl as unknown as ServiceObject,
    slices: async () => (await import("../personDocuments/personDocumentSlices")).personDocumentSlices,
    permissions: {
      ...all(["list", "listExpiring"], ["clients:view", "clients:view_own", "team:manage"]),
      ...all(["create", "update", "remove"], ["clients:manage", "team:manage"]),
    },
  },
  communication: {
    load: async () => (await import("../communication")).communicationServiceImpl as unknown as ServiceObject,
    slices: async () => (await import("../communication/communicationSlices")).communicationSlices,
    permissions: {
      ...all(
        [
          "getConnection",
          "listTemplates",
          "listLogs",
          "listLogsPaginated",
          "getMetrics",
          "getComposerContext",
          "registerAssistedMessage",
          "sendMessage",
          "retryFailedMessage",
          "syncMetaTemplates",
        ],
        VIEW_COMMUNICATION,
      ),
      // Lembretes: o professor ve so os dos alunos dele (faltas seguidas e aniversarios).
      getReminderSources: ["communication:view", "clients:view_own"],
      getReminderSummary: ["communication:view", "clients:view_own"],
      ...all(
        ["connectOfficial", "disconnectOfficial", "refreshMetaHealth", "updateConnectionSettings", "updateTemplate"],
        MANAGE_COMMUNICATION,
      ),
    },
    noRetry: ["sendMessage", "retryFailedMessage", "connectOfficial", "disconnectOfficial"],
  },
  reports: {
    load: async () => (await import("../reports")).reportsServiceImpl as unknown as ServiceObject,
    slices: async () => (await import("../reports/reportSlices")).reportSlices,
    permissions: all(["getCatalog", "generateReport"], ["reports:view"]),
  },
  studentSummary: {
    load: async () => (await import("../clients/studentSummaryService")).studentSummaryServiceImpl as unknown as ServiceObject,
    slices: async () => (await import("../clients/clientSlices")).studentSummarySlices,
    // O professor le so a ficha dos alunos dele, sem dinheiro (o service escopa e esconde).
    permissions: all(["getStudentSummary"], ["clients:view", "clients:view_own", "communication:view"]),
  },
  onlinePayments: {
    load: async () => (await import("../onlinePayments")).onlinePaymentsServiceImpl as unknown as ServiceObject,
    slices: async () => (await import("../onlinePayments/onlinePaymentSlices")).onlinePaymentSlices,
    permissions: {
      ...all(["listForCharge", "listAwaiting", "listDisputed", "getCheckout"], VIEW_BILLING),
      ...all(["createForCharge", "cancelForCharge"], MANAGE_BILLING),
    },
    noRetry: ["createForCharge"],
    browserOnly: [
      "getSettings",
      "syncSubaccountApproved",
      "updateSettings",
      "simulatePaid",
      "getRecurringForStudent",
      "listActiveRecurring",
      "requestRecurring",
      "simulateAuthorize",
      "revokeRecurring",
    ],
  },
  settings: {
    load: async () => (await import("../settings/settingsService")).settingsServiceImpl as unknown as ServiceObject,
    slices: async () => (await import("../settings/settingsSlices")).settingsSlices,
    permissions: {
      ...all(["getOrganization", "getUnit"], AUTHENTICATED),
      ...all(["updateOrganization", "updateUnit"], ["settings:view"]),
      markModalitiesReviewed: ["classes:manage", "services:manage"],
    },
  },
  onboarding: {
    load: async () => (await import("../settings/onboardingService")).onboardingServiceImpl as unknown as ServiceObject,
    slices: async () => (await import("../settings/settingsSlices")).onboardingSlices,
    permissions: all(["getOnboardingSnapshot", "getDiscoveryMilestones"], AUTHENTICATED),
  },
  certificates: {
    load: async () => (await import("../settings/certificatesService")).certificatesServiceImpl as unknown as ServiceObject,
    permissions: {
      ...all(["getTemplate", "listModalitiesWithOwnTemplate"], ["classes:manage", "classes:view", "events:view", "settings:view"]),
      ...all(["saveTemplate", "resetTemplate", "removeModalityTemplate"], MANAGE_CLASSES),
    },
    browserOnly: ["uploadLogo", "uploadArtwork"],
  },
};

export interface ResolvedMethod {
  run: (...args: unknown[]) => Promise<unknown>;
  permissions: Permission[];
  noRetry: boolean;
  /** Recorte do metodo; ausente = espaco inteiro. */
  slice?: MethodSlice;
}

/** Recorte declarado para "namespace.metodo" (servidor e conferencia dos testes). */
export async function sliceFor(name: string): Promise<MethodSlice | undefined> {
  const [namespace, method] = name.split(".");
  const entry = SERVICE_NAMESPACES[namespace];
  if (!entry?.slices || !method) return undefined;
  return (await entry.slices())[method];
}

export async function resolveServiceMethod(name: string): Promise<ResolvedMethod | undefined> {
  // So "namespace.metodo" proprios do registro e do servico: nada de
  // `__proto__`, `constructor` ou caminho mais longo.
  const parts = typeof name === "string" ? name.split(".") : [];
  if (parts.length !== 2) return undefined;
  const [namespace, method] = parts;
  if (!Object.hasOwn(SERVICE_NAMESPACES, namespace)) return undefined;
  const entry = SERVICE_NAMESPACES[namespace];
  if (!method || entry.browserOnly?.includes(method)) return undefined;
  // Negacao por padrao (revisao geral de 31/10/2026): metodo sem entrada explicita em `permissions` e recusado.
  if (!Object.hasOwn(entry.permissions, method)) return undefined;
  // Duas chamadas no primeiro uso: o import dinamico pode devolver o modulo ainda
  // inicializando (import circular) e o servico vir `undefined`. Espera e tenta
  // de novo antes de desistir (revisao geral de 31/10/2026, teste de banco).
  let service = await entry.load();
  for (let attempt = 0; !service && attempt < 5; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    service = await entry.load();
  }
  if (!service || !Object.hasOwn(service, method)) return undefined;
  const fn = service[method];
  if (typeof fn !== "function") return undefined;
  return {
    run: (...args) => (fn as (...a: unknown[]) => Promise<unknown>).apply(service, args),
    permissions: entry.permissions[method],
    noRetry: entry.noRetry?.includes(method) ?? false,
    slice: await sliceFor(name),
  };
}
