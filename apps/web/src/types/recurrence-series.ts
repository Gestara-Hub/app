import type { DateISO, DateTimeISO, Frequency, Id, TimeISO } from "./common";

export interface RecurrenceSeries {
  id: Id;
  organizationId: Id;
  unitId: Id;
  clientId: Id;
  professionalId: Id;
  serviceId: Id;
  frequency: Frequency;
  startDate: DateISO; // data da primeira ocorrencia
  time: TimeISO; // horario fixo das ocorrencias
  // Exatamente um dos dois criterios de termino (serie sempre finita).
  untilOccurrences?: number;
  untilDate?: DateISO;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}
