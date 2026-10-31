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
  /** Permissao por metodo; ausente = qualquer usuario do espaco. */
  permissions: Record<string, Permission[]>;
  /** Metodos que nao vao para o servidor (arquivo, navegador). */
  browserOnly?: string[];
  /** Metodos com efeito externo antes da gravacao: nao repetem em conflito. */
  noRetry?: string[];
  /** Recorte por metodo (doc 19, fase 2): carrega so o que o metodo le. */
  slices?: () => Promise<Record<string, MethodSlice>>;
}

const MANAGE_CLIENTS: Permission[] = ["clients:manage"];
const MANAGE_CLASSES: Permission[] = ["classes:manage"];
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
    permissions: all(["create", "update", "remove"], MANAGE_CLIENTS),
  },
  turmas: {
    load: async () => (await import("../classes")).turmasServiceImpl as unknown as ServiceObject,
    slices: async () => (await import("../classes/classSlices")).classSlices,
    permissions: {
      ...all(["create", "update", "deactivate", "reactivate", "substituteInstructor", "restorePrimaryInstructor"], MANAGE_CLASSES),
      ...all(
        [
          "enroll",
          "setEnrollmentPayment",
          "cancelEnrollment",
          "addToWaitlist",
          "promoteFromWaitlist",
          "removeFromWaitlist",
          "reserveSession",
          "cancelReservation",
        ],
        MANAGE_ENROLLMENT,
      ),
      ...all(["markAttendance", "markManyAttendance", "clearAttendance"], MARK_ATTENDANCE),
    },
  },
  billing: {
    load: async () => (await import("../billing")).billingServiceImpl as unknown as ServiceObject,
    slices: async () => (await import("../billing/billingSlices")).billingSlices,
    permissions: {
      ...all(["listCharges", "listChargesPaginated"], VIEW_BILLING),
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
    permissions: all(["create", "update", "remove", "setGrades"], MANAGE_GRADES),
  },
  measurements: {
    load: async () => (await import("../measurements")).measurementsServiceImpl as unknown as ServiceObject,
    slices: async () => (await import("../measurements/measurementSlices")).measurementSlices,
    permissions: all(["create", "update", "remove"], MANAGE_PROGRESSION),
  },
  communication: {
    load: async () => (await import("../communication")).communicationServiceImpl as unknown as ServiceObject,
    slices: async () => (await import("../communication/communicationSlices")).communicationSlices,
    permissions: {
      ...all(
        ["getConnection", "listTemplates", "listLogs", "listLogsPaginated", "getMetrics", "registerAssistedMessage", "sendMessage", "retryFailedMessage", "syncMetaTemplates"],
        VIEW_COMMUNICATION,
      ),
      // Lembretes: o professor ve so os dos alunos dele (faltas seguidas e aniversarios).
      getReminderSources: ["communication:view", "clients:view_own"],
      ...all(["connectOfficial", "disconnectOfficial", "updateConnectionSettings", "updateTemplate"], MANAGE_COMMUNICATION),
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
      ...all(["listForCharge", "listAwaiting", "getCheckout"], VIEW_BILLING),
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
    permissions: {
      ...all(["updateOrganization", "updateUnit"], ["settings:view"]),
      markModalitiesReviewed: ["classes:manage", "services:manage"],
    },
  },
  onboarding: {
    load: async () => (await import("../settings/onboardingService")).onboardingServiceImpl as unknown as ServiceObject,
    permissions: {},
  },
  certificates: {
    load: async () => (await import("../settings/certificatesService")).certificatesServiceImpl as unknown as ServiceObject,
    permissions: all(["saveTemplate", "resetTemplate"], MANAGE_CLASSES),
    browserOnly: ["uploadLogo"],
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
  const [namespace, method] = name.split(".");
  const entry = SERVICE_NAMESPACES[namespace];
  if (!entry || !method || entry.browserOnly?.includes(method)) return undefined;
  const service = await entry.load();
  const fn = service[method];
  if (typeof fn !== "function") return undefined;
  return {
    run: (...args) => (fn as (...a: unknown[]) => Promise<unknown>).apply(service, args),
    permissions: entry.permissions[method] ?? [],
    noRetry: entry.noRetry?.includes(method) ?? false,
    slice: await sliceFor(name),
  };
}
