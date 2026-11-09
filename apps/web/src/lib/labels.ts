import type {
  AppointmentStatus,
  AuditAction,
  AuditEntityType,
  Frequency,
  FinancialEntryDisplayStatus,
  FinancialEntryType,
  OperationalModel,
  PaidFeature,
  PaymentMethod,
  RecordStatus,
  SubscriptionTier,
  TeacherPayComponentKind,
  TeacherPayoutStatus,
  UserProfile,
} from "@gestarahub/contracts";

/**
 * Rotulos de exibicao (PT, vistos pelo usuario) para os codigos de enum.
 * Os codigos ficam em ingles no dado; a UI traduz por aqui.
 *
 * NOTA: categoria de servico deixou de ser enum — virou entidade `Category`
 * (nome guardado no dado, editavel pelo tenant). Ver `categoriesService`.
 */

const RECORD_STATUS_LABEL: Record<RecordStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
};

export function recordStatusLabel(status: RecordStatus): string {
  return RECORD_STATUS_LABEL[status];
}

const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  in_service: "Em atendimento",
  completed: "Concluído",
  canceled: "Cancelado",
  no_show: "Não compareceu",
};

export function appointmentStatusLabel(status: AppointmentStatus): string {
  return APPOINTMENT_STATUS_LABEL[status];
}

const FREQUENCY_LABEL: Record<Frequency, string> = {
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

export function frequencyLabel(frequency: Frequency): string {
  return FREQUENCY_LABEL[frequency];
}

const USER_PROFILE_LABEL: Record<UserProfile, string> = {
  owner: "Proprietário",
  manager: "Gerente",
  attendant: "Atendente",
  professional: "Profissional",
};

/** `teacherTitle`: a palavra do espaço para quem dá aula (instrutor, professor), no lugar de "Profissional". */
export function userProfileLabel(profile: UserProfile, teacherTitle?: string): string {
  if (profile === "professional" && teacherTitle) return teacherTitle;
  return USER_PROFILE_LABEL[profile];
}

const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  created: "Criou",
  updated: "Atualizou",
  deleted: "Removeu",
  cancelled: "Cancelou",
  rescheduled: "Remarcou",
  status_changed: "Mudou status",
  activated: "Reativou",
  inactivated: "Inativou",
};

export function auditActionLabel(action: AuditAction): string {
  return AUDIT_ACTION_LABEL[action];
}

const AUDIT_ENTITY_TYPE_LABEL: Record<AuditEntityType, string> = {
  appointment: "Agendamento",
  client: "Cliente",
  service: "Serviço",
  category: "Categoria",
  role: "Cargo",
  professional: "Profissional",
  user: "Usuário",
  settings: "Configurações",
  plan: "Plano",
  lesson_package: "Pacote de aulas",
  charge: "Cobrança",
  class_group: "Turma",
  enrollment: "Matrícula",
  event: "Evento",
  event_registration: "Inscrição em evento",
  assessment: "Avaliação",
  measurement: "Testes e medidas",
  certificate: "Certificado",
  financial_entry: "Lançamento financeiro",
  financial_category: "Categoria financeira",
  teacher_payout: "Pagamento de professor",
  teacher_pay_rule: "Regra de pagamento",
  online_payment: "Pagamento online",
  subscription: "Plano GestaraHub",
  communication_session: "Conexão WhatsApp",
  message_template: "Modelo de mensagem",
  message_log: "Mensagem WhatsApp",
};

// No modelo de turmas, cliente e aluno e categoria e modalidade.
const CLASSES_ENTITY_TYPE_LABEL: Partial<Record<AuditEntityType, string>> = {
  client: "Aluno",
  category: "Modalidade",
};

export function auditEntityTypeLabel(
  type: AuditEntityType,
  model?: OperationalModel,
  teacherTitle?: string,
): string {
  if (type === "professional" && teacherTitle) return teacherTitle;
  if (type === "teacher_payout" && teacherTitle) return `Pagamento de ${teacherTitle.toLowerCase()}`;
  return (model === "classes" && CLASSES_ENTITY_TYPE_LABEL[type]) || AUDIT_ENTITY_TYPE_LABEL[type];
}

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  card: "Cartão",
  other: "Outro",
};

export const PAYMENT_METHODS: PaymentMethod[] = ["pix", "cash", "card", "other"];

export function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABEL[method];
}

// --- Plano GestaraHub e Financeiro -----------------------------------------

const SUBSCRIPTION_TIER_LABEL: Record<SubscriptionTier, string> = {
  free: "Grátis",
  pro: "Profissional",
  scale: "Expansão",
};

export function subscriptionTierLabel(tier: SubscriptionTier): string {
  return SUBSCRIPTION_TIER_LABEL[tier];
}

const PAID_FEATURE_LABEL: Record<PaidFeature, string> = {
  online_payments: "Pagamento online",
  reports_advanced: "Relatórios avançados",
  messaging: "Comunicação automática",
  certificates: "Certificado de conclusão",
  bi: "BI & Analytics",
};

export function paidFeatureLabel(feature: PaidFeature): string {
  return PAID_FEATURE_LABEL[feature];
}

const FINANCIAL_ENTRY_TYPE_LABEL: Record<FinancialEntryType, string> = {
  income: "Entrada",
  expense: "Saída",
};

export function financialEntryTypeLabel(type: FinancialEntryType): string {
  return FINANCIAL_ENTRY_TYPE_LABEL[type];
}

const FINANCIAL_ENTRY_STATUS_LABEL: Record<FinancialEntryDisplayStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Atrasado",
  canceled: "Cancelado",
};

export function financialEntryStatusLabel(status: FinancialEntryDisplayStatus): string {
  return FINANCIAL_ENTRY_STATUS_LABEL[status];
}

const TEACHER_PAY_COMPONENT_LABEL: Record<TeacherPayComponentKind, string> = {
  fixed_monthly: "Fixo mensal",
  per_session: "Por aula dada",
  per_student: "Por aluno ativo",
  percent_of_memberships: "% do que os alunos pagaram",
};

export function teacherPayComponentLabel(kind: TeacherPayComponentKind): string {
  return TEACHER_PAY_COMPONENT_LABEL[kind];
}

const TEACHER_PAYOUT_STATUS_LABEL: Record<TeacherPayoutStatus, string> = {
  open: "Prévia",
  closed: "Fechado",
  paid: "Pago",
  canceled: "Cancelado",
};

export function teacherPayoutStatusLabel(status: TeacherPayoutStatus): string {
  return TEACHER_PAYOUT_STATUS_LABEL[status];
}
