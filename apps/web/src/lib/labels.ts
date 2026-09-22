import type {
  AppointmentStatus,
  AuditAction,
  AuditEntityType,
  Frequency,
  OperationalModel,
  PaymentMethod,
  RecordStatus,
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

export function userProfileLabel(profile: UserProfile): string {
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
  charge: "Mensalidade",
  class_group: "Turma",
  enrollment: "Matrícula",
};

// No modelo de turmas, cliente e aluno e categoria e modalidade.
const CLASSES_ENTITY_TYPE_LABEL: Partial<Record<AuditEntityType, string>> = {
  client: "Aluno",
  category: "Modalidade",
};

export function auditEntityTypeLabel(
  type: AuditEntityType,
  model?: OperationalModel,
): string {
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
