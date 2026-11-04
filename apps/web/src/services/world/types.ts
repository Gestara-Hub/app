import type {
  Appointment,
  Assessment,
  StudentMeasurement,
  IssuedCertificate,
  PersonDocument,
  Attendance,
  AuditLogEntry,
  Category,
  CertificateTemplate,
  Charge,
  ClassGroup,
  ClassReservation,
  ClassSessionOverride,
  Client,
  Enrollment,
  FinancialCategory,
  FinancialEntry,
  FinancialRecurrence,
  LessonPackage,
  MessageLog,
  MessageTemplate,
  OnlinePayment,
  Organization,
  Plan,
  Professional,
  RecurrenceSeries,
  RecurringAuthorization,
  Role,
  Service,
  StudentPackage,
  TeacherPayout,
  TeacherPayRule,
  TimeBlock,
  Unit,
  User,
  WaitlistEntry,
  WhatsAppConnection,
} from "@gestarahub/contracts";

/**
 * O espaco de um tenant em memoria (doc 15): todas as colecoes no formato dos
 * contratos. No servidor e carregado do banco por requisicao
 * (`services/world/runWorld`); nos testes de regra e na demonstracao da
 * barbearia (modelo de agenda, ainda sem banco), vem do mundo local do mock.
 */
export interface TenantWorld {
  organization: Organization;
  unit: Unit;
  clients: Client[];
  professionals: Professional[];
  users: User[];
  roles: Role[];
  categories: Category[];
  services: Service[];
  appointments: Appointment[];
  timeBlocks: TimeBlock[];
  series: RecurrenceSeries[];
  // Log de auditoria (append-only): registrado pelos services em cada mutacao.
  auditLog: AuditLogEntry[];
  // Modelo 3 (turmas) — presentes em todos os tenants; vazios exceto no de
  // classes. Sessoes sao geradas on-the-fly dos meetingSlots (nao armazenadas);
  // so a presenca e persistida (por sessionId deterministico).
  classGroups: ClassGroup[];
  enrollments: Enrollment[];
  attendances: Attendance[];
  // Financeiro do M3 (planos + cobrancas).
  plans: Plan[];
  charges: Charge[];
  // Pacotes de aulas (doc 20, fase C): catalogo e compras dos alunos.
  lessonPackages: LessonPackage[];
  studentPackages: StudentPackage[];
  // M3 Fatia 3: lista de espera e reservas (drop-in).
  waitlist: WaitlistEntry[];
  reservations: ClassReservation[];
  sessionOverrides?: ClassSessionOverride[];
  // Avaliacoes e notas (doc 21 §2.1). Opcional: nasce vazio no 1o lancamento,
  // sem migracao (ver gradesService.assessmentsStore).
  assessments?: Assessment[];
  // Testes e medidas dos alunos (doc 21 §2.4). Opcional como as avaliacoes.
  studentMeasurements?: StudentMeasurement[];
  // Certificados emitidos, com codigo de verificacao (doc 21 §1.3). Opcional como as avaliacoes.
  issuedCertificates?: IssuedCertificate[];
  // Documentos da ficha do aluno e do instrutor (doc product/28). Opcional como as avaliacoes.
  personDocuments?: PersonDocument[];
  // Financeiro do negocio (plano pago). Presentes em todos os tenants; as
  // categorias padrao so sao semeadas no de classes. Ver docs/technical/05.
  financialCategories: FinancialCategory[];
  financialEntries: FinancialEntry[];
  financialRecurrences: FinancialRecurrence[];
  teacherPayRules: TeacherPayRule[];
  teacherPayouts: TeacherPayout[];
  onlinePayments: OnlinePayment[];
  recurringAuthorizations: RecurringAuthorization[];
  // Comunicacao: WhatsApp do proprio espaco (assistido gratis; oficial no Pro)
  whatsAppConnection?: WhatsAppConnection;
  messageTemplates: MessageTemplate[];
  messageLogs: MessageLog[];
  // Modelo de certificado do espaco (Plano Profissional). Ausente = modelo padrao.
  certificateTemplate?: CertificateTemplate;
  // Modelo do certificado de graduacao (doc 21 §1.6). Ausente = modelo padrao da area.
  graduationCertificateTemplate?: CertificateTemplate;
  // Deprecated backward compatibility properties
  cobrancas?: Charge[];
  reservas?: ClassReservation[];
}
