import type { Address, Id, RecordStatus, TimeISO, Weekday } from "./common";

/**
 * Modelo operacional do tenant (estrutural — define o app inteiro). Ortogonal ao
 * `segment` (vertical/rotulo). Ver docs/technical/01-extensao-modelos-operacionais.
 * "scheduling" = Modelo 1 (atendimento individual); "classes" = Modelo 3
 * (turmas/aulas); "delivery" = Modelo 2 (entrega/encomenda).
 */
export type OperationalModel = "scheduling" | "classes" | "delivery";

export type OrganizationBillingTiming = "prepaid" | "postpaid";
export type OrganizationMidMonthStrategy = "prorated" | "full_cycle";

export interface OrganizationSettings {
  defaultDueDay?: number; // dia padrão de vencimento de mensalidades (ex: 10)
  billingTiming?: OrganizationBillingTiming; // 'prepaid' (no ato) ou 'postpaid' (ao final) - default: 'prepaid'
  midMonthStrategy?: OrganizationMidMonthStrategy; // 'prorated' (proporcional) ou 'full_cycle' (ciclo 30 dias) - default: 'prorated'
}

export interface Organization {
  id: Id;
  name: string; // 'Corte Nobre'
  segment: string; // 'Barbearia' (vertical/rotulo — nao confundir com `model`)
  model: OperationalModel; // modelo operacional (estrutural)
  settings?: OrganizationSettings;
  status: RecordStatus;
}

export interface BusinessHoursShift {
  start: TimeISO;
  end: TimeISO;
}

export interface BusinessHoursDay {
  weekday: Weekday;
  closed: boolean; // domingo = true
  start?: TimeISO; // presente quando closed = false (retrocompatibilidade: primeiro turno)
  end?: TimeISO; // presente quando closed = false (retrocompatibilidade: ultimo turno)
  shifts?: BusinessHoursShift[]; // turnos/intervalos de funcionamento
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

