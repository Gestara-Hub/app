import type {
  AppointmentFilter,
  CertificateKind,
  MessageLogFilter,
  AuditLogFilter,
  CategoryFilter,
  ChargeFilter,
  ClassGroupFilter,
  ClientFilter,
  DateISO,
  FinancialCategoryFilter,
  FinancialEntryFilter,
  Id,
  LessonPackageFilter,
  PlanFilter,
  ProfessionalFilter,
  RoleFilter,
  ServiceFilter,
  StudentPackageFilter,
  TimeBlockFilter,
  UserFilter,
  UserProfile,
  EventFilter,
} from "@gestarahub/contracts";

/**
 * Convencao de queryKeys (hierarquia estavel):
 *  - [entity] para o namespace,
 *  - [entity, 'list', filter] para listas,
 *  - [entity, 'detail', id] para detalhe.
 * Filtros entram como objeto serializavel (o Query faz hash estrutural).
 */
export const queryKeys = {
  clients: {
    all: ["clients"] as const,
    list: (filter?: ClientFilter) => ["clients", "list", filter] as const,
    // Seletores de aluno (so nome, telefone, nascimento, plano e bolsa).
    options: (filter?: ClientFilter) => ["clients", "options", filter] as const,
    detail: (id: Id) => ["clients", "detail", id] as const,
    // Alunos que fizeram aula experimental (selo, filtro, lembrete): reservas e matriculas o invalidam.
    trials: ["clients", "trials"] as const,
    // Visitantes (so evento): inscricao, matricula, plano e pacote o invalidam.
    visitors: ["clients", "visitors"] as const,
    progressionTerms: (modalityId: Id) => ["clients", "progression-terms", modalityId] as const,
    // Resumo do aluno (ficha): cobrancas, pacotes, chamada e mensagens tambem o invalidam.
    summaries: ["clients", "summary"] as const,
    summary: (id: Id) => ["clients", "summary", id] as const,
    // Certificado de graduacao (doc 21 §1.6) e as graduacoes para a previa do editor.
    graduationCertificates: ["clients", "graduation-certificate"] as const,
    graduationCertificate: (promotionId: Id) => ["clients", "graduation-certificate", promotionId] as const,
    graduations: ["clients", "graduations"] as const,
    graduationPreview: (promotionId: Id) => ["clients", "graduation-certificate", "preview", promotionId] as const,
  },
  professionals: {
    all: ["professionals"] as const,
    list: (filter?: ProfessionalFilter) =>
      ["professionals", "list", filter] as const,
    detail: (id: Id) => ["professionals", "detail", id] as const,
  },
  users: {
    all: ["users"] as const,
    list: (filter?: UserFilter) => ["users", "list", filter] as const,
    detail: (id: Id) => ["users", "detail", id] as const,
  },
  legalConsent: {
    all: ["legalConsent"] as const,
    check: (userId?: Id, consentType?: string, version?: string) =>
      ["legalConsent", "check", userId, consentType, version] as const,
  },
  services: {
    all: ["services"] as const,
    list: (filter?: ServiceFilter) => ["services", "list", filter] as const,
    detail: (id: Id) => ["services", "detail", id] as const,
  },
  categories: {
    all: ["categories"] as const,
    list: (filter?: CategoryFilter) => ["categories", "list", filter] as const,
    detail: (id: Id) => ["categories", "detail", id] as const,
  },
  roles: {
    all: ["roles"] as const,
    list: (filter?: RoleFilter) => ["roles", "list", filter] as const,
    detail: (id: Id) => ["roles", "detail", id] as const,
  },
  appointments: {
    all: ["appointments"] as const,
    list: (filter?: AppointmentFilter) =>
      ["appointments", "list", filter] as const,
    detail: (id: Id) => ["appointments", "detail", id] as const,
    occurrences: (seriesId: Id) =>
      ["appointments", "series", seriesId] as const,
  },
  timeBlocks: {
    all: ["timeBlocks"] as const,
    list: (filter?: TimeBlockFilter) => ["timeBlocks", "list", filter] as const,
  },
  series: {
    detail: (id: Id) => ["series", "detail", id] as const,
  },
  audit: {
    all: ["audit"] as const,
    // O perfil do espectador entra na key: a visibilidade do log varia por perfil.
    list: (filter?: AuditLogFilter, viewer?: UserProfile) =>
      ["audit", "list", filter, viewer] as const,
  },
  classes: {
    all: ["classes"] as const,
    list: (filter?: ClassGroupFilter) => ["classes", "list", filter] as const,
    detail: (id: Id) => ["classes", "detail", id] as const,
    enrollments: (classGroupId: Id) =>
      ["classes", "enrollments", classGroupId] as const,
    sessions: (range: { classGroupId?: Id; dateFrom: DateISO; dateTo: DateISO }) =>
      ["classes", "sessions", range] as const,
    session: (sessionId: Id) => ["classes", "session", sessionId] as const,
    waitlist: (classGroupId: Id) => ["classes", "waitlist", classGroupId] as const,
    attendanceSummary: (date: DateISO) =>
      ["classes", "attendanceSummary", date] as const,
    absenceStreaks: ["classes", "absenceStreaks"] as const,
    enrolledModalities: ["classes", "enrolledModalities"] as const,
    certificates: ["classes", "certificate"] as const,
    certificate: (enrollmentId: Id) => ["classes", "certificate", enrollmentId] as const,
    completedEnrollments: ["classes", "certificate", "completed"] as const,
    certificatePreview: (enrollmentId: Id) => ["classes", "certificate", "preview", enrollmentId] as const,
  },
  // Notas dos alunos (avaliacoes da turma, lancamento e boletim).
  grades: {
    all: ["grades"] as const,
    classAssessments: (classGroupId: Id) => ["grades", "class", classGroupId] as const,
    sheet: (assessmentId: Id) => ["grades", "sheet", assessmentId] as const,
    reportCard: (studentId: Id) => ["grades", "reportCard", studentId] as const,
  },
  // Testes e medidas dos alunos (doc 21 §2.4).
  personDocuments: {
    all: ["personDocuments"] as const,
    owner: (ownerKind: string, ownerId: Id) => ["personDocuments", ownerKind, ownerId] as const,
    expiring: ["personDocuments", "expiring"] as const,
  },
  measurements: {
    all: ["measurements"] as const,
    student: (studentId: Id) => ["measurements", "student", studentId] as const,
  },
  // Eventos e seminarios (doc product/29): evento, dias e inscricoes.
  events: {
    all: ["events"] as const,
    list: (filter?: EventFilter) => ["events", "list", filter] as const,
    detail: (id: Id) => ["events", "detail", id] as const,
    registrations: (eventId: Id) => ["events", "registrations", eventId] as const,
    sessions: (range: { dateFrom: DateISO; dateTo: DateISO }) => ["events", "sessions", range] as const,
    session: (sessionId: Id) => ["events", "session", sessionId] as const,
    certificates: ["events", "certificate"] as const,
    certificate: (registrationId: Id) => ["events", "certificate", registrationId] as const,
    certificateCandidates: (eventId: Id) => ["events", "certificate", "candidates", eventId] as const,
  },
  billing: {
    all: ["billing"] as const,
    plans: (filter?: PlanFilter) => ["billing", "plans", filter] as const,
    charges: (filter?: ChargeFilter) => ["billing", "charges", filter] as const,
  },
  // Pacotes de aulas: catalogo e saldo dos alunos (a chamada muda o saldo).
  packages: {
    all: ["packages"] as const,
    catalog: (filter?: LessonPackageFilter) => ["packages", "catalog", filter] as const,
    students: (filter?: StudentPackageFilter) => ["packages", "students", filter] as const,
  },
  // Financeiro do negocio (plano pago). Marcar uma cobranca como paga
  // (Cobrancas) invalida `finance.all`; presenca/matricula/substituicao
  // invalidam `teacherPay.all` (a previa depende delas).
  finance: {
    all: ["finance"] as const,
    summary: (competence: string) => ["finance", "summary", competence] as const,
    series: (months: number, endCompetence?: string) =>
      ["finance", "series", months, endCompetence] as const,
    byCategory: (competence: string) => ["finance", "byCategory", competence] as const,
    upcoming: (days: number) => ["finance", "upcoming", days] as const,
    entries: (filter?: FinancialEntryFilter) => ["finance", "entries", filter] as const,
    categories: (filter?: FinancialCategoryFilter) =>
      ["finance", "categories", filter] as const,
    // Financeiro de um evento (doc product/29): muda com cobrancas e lancamentos.
    event: (eventId: Id) => ["finance", "event", eventId] as const,
  },
  teacherPay: {
    all: ["teacherPay"] as const,
    rules: ["teacherPay", "rules"] as const,
    teachers: ["teacherPay", "teachers"] as const,
    payouts: (competence: string) => ["teacherPay", "payouts", competence] as const,
    preview: (professionalId: Id, competence: string) =>
      ["teacherPay", "preview", professionalId, competence] as const,
  },
  onlinePayments: {
    all: ["onlinePayments"] as const,
    forCharge: (chargeId: Id) => ["onlinePayments", "charge", chargeId] as const,
    awaiting: ["onlinePayments", "awaiting"] as const,
    disputed: ["onlinePayments", "disputed"] as const,
    recurring: (studentId: Id) => ["onlinePayments", "recurring", studentId] as const,
  },
  subscription: {
    detail: ["subscription"] as const,
  },
  organization: {
    detail: ["organization"] as const,
  },
  // Modelo de certificado do espaco (Plano Profissional).
  certificates: {
    /** Modelo do espaco (sem modalidade) ou de uma modalidade. */
    template: (modalityId?: Id, kind: CertificateKind = "course") => ["certificates", "template", kind, modalityId ?? "space"] as const,
    ownTemplates: (kind: CertificateKind = "course") => ["certificates", "own-templates", kind] as const,
  },
  unit: {
    detail: ["unit"] as const,
  },
  // Marcos do "Descubra o dia a dia" (Dashboard): qualquer mutacao os refaz
  // (ver `createQueryClient`).
  onboarding: {
    discovery: ["onboarding", "discovery"] as const,
    // Passos da configuracao inicial (contagens, uma leitura); `setupDone` e so
    // do navegador: com os passos prontos, as gravacoes deixam de rele-los.
    snapshot: ["onboarding", "snapshot"] as const,
    setupDone: ["onboarding", "setup-done"] as const,
  },
  communication: {
    all: ["communication"] as const,
    session: ["communication", "session"] as const,
    templates: ["communication", "templates"] as const,
    logs: (filter?: { trigger?: string; status?: string; search?: string; clientId?: Id }) =>
      ["communication", "logs", filter] as const,
    // Pagina do historico (mesma raiz: gravar mensagem invalida as duas).
    logsPage: (filter?: MessageLogFilter) => ["communication", "logs", "page", filter] as const,
    metrics: ["communication", "metrics"] as const,
    // Lembretes (doc product/25): mudam com mensagens, cobrancas e presencas.
    reminders: ["communication", "reminders"] as const,
  },
  reports: {
    all: ["reports"] as const,
    catalog: ["reports", "catalog"] as const,
    data: (type: string, filter?: Record<string, unknown>) =>
      ["reports", "data", type, filter] as const,
  },
} as const;
