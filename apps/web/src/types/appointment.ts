import type {
  AppointmentOrigin,
  AppointmentStatus,
  DateISO,
  DateTimeISO,
  Id,
  TimeISO,
} from "./common";

export interface Appointment {
  id: Id;
  organizationId: Id;
  unitId: Id;
  clientId: Id;
  professionalId: Id;
  serviceId: Id;
  date: DateISO; // 'YYYY-MM-DD'
  start: TimeISO; // 'HH:mm'
  end: TimeISO; // derivado de start + durationMinutes do service
  status: AppointmentStatus;
  origin: AppointmentOrigin;
  notes?: string;
  seriesId?: Id; // presente quando faz parte de uma serie recorrente
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

// Agendamento manual: 'end' e derivado da duracao; 'origin' fixado como 'manual'.
export type CreateAppointment = Omit<
  Appointment,
  "id" | "end" | "origin" | "status" | "createdAt" | "updatedAt"
> & {
  status?: AppointmentStatus; // default 'pending'
};

export type UpdateAppointment = Partial<CreateAppointment>;

export interface AppointmentFilter {
  // Periodo (inclusivo). Para a Agenda diaria, dateFrom === dateTo.
  dateFrom?: DateISO;
  dateTo?: DateISO;
  professionalId?: Id;
  clientId?: Id;
  status?: AppointmentStatus | AppointmentStatus[];
  origin?: AppointmentOrigin;
  seriesId?: Id;
  search?: string; // por cliente
}
