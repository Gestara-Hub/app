import type { Id, RecordStatus, TimeISO, Weekday } from "./common";

export interface Organization {
  id: Id;
  name: string; // 'Corte Nobre'
  segment: string; // 'Barbearia'
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
  address?: string;
  phone?: string;
  status: RecordStatus;
  businessHours: BusinessHoursDay[]; // horario de funcionamento da unidade
}
