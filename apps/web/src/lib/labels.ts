import type {
  AppointmentStatus,
  Frequency,
  RecordStatus,
  UserProfile,
} from "@/types";

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
