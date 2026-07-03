import type { DateISO, DateTimeISO, Frequency, Id, TimeISO } from "./common";

export interface RecurrenceSeries {
  id: Id;
  organizationId: Id;
  unitId: Id;
  clientId: Id;
  professionalId: Id;
  serviceIds: Id[]; // mesmos servicos aplicados a cada ocorrencia
  frequency: Frequency;
  startDate: DateISO; // data da primeira ocorrencia
  time: TimeISO; // horario fixo das ocorrencias
  // Exatamente um dos dois criterios de termino (serie sempre finita).
  untilOccurrences?: number;
  untilDate?: DateISO;
  notes?: string;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export type CreateRecurrenceSeries = Omit<
  RecurrenceSeries,
  "id" | "createdAt" | "updatedAt"
>;
