import type { Address, Id, RecordStatus, TimeISO, Weekday } from "./common";

/**
 * Modelo operacional do tenant (estrutural — define o app inteiro). Ortogonal ao
 * `segment` (vertical/rotulo). Ver docs/technical/01-extensao-modelos-operacionais.
 * "scheduling" = Modelo 1 (atendimento individual); "classes" = Modelo 3
 * (turmas/aulas); "delivery" = Modelo 2 (entrega/encomenda).
 */
export type OperationalModel = "scheduling" | "classes" | "delivery";

export interface OrganizationSettings {
  defaultDueDay?: number; // dia padrão de vencimento de mensalidades (ex: 10)
}

export interface Organization {
  id: Id;
  name: string; // 'Corte Nobre'
  segment: string; // 'Barbearia' (vertical/rotulo — nao confundir com `model`)
  model: OperationalModel; // modelo operacional (estrutural)
  settings?: OrganizationSettings;
  status: RecordStatus;
}

export interface BusinessHoursDay {
  weekday: Weekday;
  closed: boolean; // domingo = true
  start?: TimeISO; // presente quando closed = false
  end?: TimeISO; // presente quando closed = false
}

export interface Unit {
  id: Id;
  organizationId: Id;
  name: string; // 'Corte Nobre - Matriz'
  address?: Address | string;
  phone?: string;
  status: RecordStatus;
  businessHours: BusinessHoursDay[]; // horario de funcionamento da unidade
}

