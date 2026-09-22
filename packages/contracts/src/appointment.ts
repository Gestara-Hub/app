import type {
  AppointmentOrigin,
  AppointmentStatus,
  DateISO,
  DateTimeISO,
  Id,
  RecordStatus,
  TimeISO,
  TenantScopeFields,
} from "./common";

export interface Appointment {
  id: Id;
  organizationId: Id;
  unitId: Id;
  clientId: Id;
  professionalId: Id;
  serviceIds: Id[]; // 1..n servicos do agendamento (duracao/preco = soma)
  date: DateISO; // 'YYYY-MM-DD'
  start: TimeISO; // 'HH:mm'
  end: TimeISO; // derivado de start + durationMinutes do service
  status: AppointmentStatus;
  origin: AppointmentOrigin;
  notes?: string;
  cancellationReason?: string; // motivo obrigatorio ao cancelar (doc 05)
  noShowReason?: string; // motivo opcional ao marcar como nao compareceu (doc 05)
  seriesId?: Id; // presente quando faz parte de uma serie recorrente
  // Rastro de remarcacao: slots anteriores (mais antigo primeiro) + motivo informado.
  rescheduledFrom?: { date: DateISO; start: TimeISO; professionalId: Id; reason?: string }[];
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

// Agendamento manual: 'end' e derivado da duracao; 'origin' fixado como 'manual'.
export type CreateAppointment = Omit<
  Appointment,
  "id" | "end" | "origin" | "status" | "createdAt" | "updatedAt" | TenantScopeFields
> & {
  status?: AppointmentStatus; // default 'pending'
};

export type UpdateAppointment = Partial<CreateAppointment>;

// Remarcacao: move data/horario/profissional (mantem cliente e servico).
// O motivo e opcional e, quando informado, fica no rastro do historico (doc 05).
export interface RescheduleAppointment {
  date?: DateISO;
  start?: TimeISO;
  professionalId?: Id;
  reason?: string;
}

// Cancelamento: exige motivo; o registro permanece no historico (doc 05).
export interface CancelAppointment {
  reason: string;
}

/**
 * Read model retornado pelos GET de agendamento: o `Appointment` com cliente,
 * profissional e servico ja expandidos (o que a API faria com join no servidor).
 * A Agenda le os nomes/duracao/preco direto, sem buscar cada cadastro e juntar.
 */
export interface AppointmentView extends Appointment {
  client: { id: Id; name: string; status: RecordStatus };
  professional: { id: Id; name: string; status: RecordStatus };
  // Servicos expandidos (na ordem de `serviceIds`) + totais derivados.
  services: {
    id: Id;
    name: string;
    durationMinutes: number;
    priceCents: number;
    status: RecordStatus;
  }[];
  totalDurationMinutes: number;
  totalPriceCents: number;
}

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
