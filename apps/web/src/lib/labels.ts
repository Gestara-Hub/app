import type {
  AppointmentStatus,
  Frequency,
  RecordStatus,
  ServiceCategory,
} from "@/types";

/**
 * Rotulos de exibicao (PT, vistos pelo usuario) para os codigos de enum.
 * Os codigos ficam em ingles no dado; a UI traduz por aqui.
 */

// Ordem canonica das categorias (para agrupar/ordenar listas).
export const SERVICE_CATEGORIES: ServiceCategory[] = [
  "hair",
  "beard",
  "care",
  "combo",
];

const SERVICE_CATEGORY_LABEL: Record<ServiceCategory, string> = {
  hair: "Cabelo",
  beard: "Barba",
  care: "Cuidados",
  combo: "Combos",
};

export function serviceCategoryLabel(category: ServiceCategory): string {
  return SERVICE_CATEGORY_LABEL[category];
}

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
