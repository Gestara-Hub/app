import type {
  Appointment,
  CreateRecurrenceSeries,
  DateISO,
  Id,
  RecurrenceSeries,
  Service,
} from "@gestarahub/contracts";
import { store } from "@/mocks/store";
import {
  apiError,
  newId,
  nowIso,
  simulateWrite,
  validationError,
} from "@/mocks/helpers";
import {
  addMinutesToTime,
  checkSlotAvailability,
  generateOccurrenceDates,
  type SlotConflictCode,
  type SlotContext,
} from "@/lib/scheduling";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function occupies(status: Appointment["status"]): boolean {
  return status !== "canceled" && status !== "no_show";
}

function slotContext(professionalId: Id, date: DateISO): SlotContext {
  const professional = store.professionals.find((p) => p.id === professionalId);
  return {
    businessHours: store.unit.businessHours,
    workingHours: professional?.workingHours ?? [],
    blocks: store.timeBlocks
      .filter((b) => b.professionalId === professionalId && b.date === date)
      .map((b) => ({ start: b.start, end: b.end })),
    appointments: store.appointments
      .filter(
        (a) =>
          a.professionalId === professionalId &&
          a.date === date &&
          occupies(a.status),
      )
      .map((a) => ({ start: a.start, end: a.end })),
  };
}

export interface SeriesGenerationResult {
  series: RecurrenceSeries;
  createdCount: number;
  conflicts: { date: DateISO; code: SlotConflictCode }[];
}

export const recurrenceService = {
  /**
   * Cria uma serie e gera suas ocorrencias. Ocorrencias em conflito (ocupado,
   * fora do expediente, bloqueio) NAO sao criadas — ficam sinalizadas; as demais
   * sao criadas normalmente (regra do doc 05).
   */
  create(payload: CreateRecurrenceSeries): Promise<SeriesGenerationResult> {
    return simulateWrite(() => {
      const professional = store.professionals.find((p) => p.id === payload.professionalId);
      const services = (payload.serviceIds ?? []).map((id) =>
        store.services.find((s) => s.id === id),
      );
      const client = store.clients.find((c) => c.id === payload.clientId);

      const fields = [];
      if (!client) fields.push({ field: "clientId", message: "Selecione um cliente." });
      if (!professional) fields.push({ field: "professionalId", message: "Selecione um profissional." });
      if (services.length === 0 || services.some((s) => !s)) {
        fields.push({ field: "serviceIds", message: "Selecione ao menos um serviço." });
      }
      if (!payload.untilOccurrences && !payload.untilDate) {
        fields.push({ field: "untilOccurrences", message: "Defina o término por número de ocorrências ou data." });
      }
      if (fields.length > 0 || !professional || !client || services.some((s) => !s)) {
        throw validationError(fields);
      }
      const found = services as Service[];

      if (professional.status !== "active") {
        throw apiError("PROFESSIONAL_INACTIVE", "Este profissional está inativo.", {
          fields: [{ field: "professionalId", message: "Este profissional está inativo." }],
          httpStatus: 422,
        });
      }
      const inactive = found.find((s) => s.status !== "active");
      if (inactive) {
        const message = `${inactive.name} está inativo.`;
        throw apiError("SERVICE_INACTIVE", message, {
          fields: [{ field: "serviceIds", message }],
          httpStatus: 422,
        });
      }
      const notOffered = found.find((s) => !professional.serviceIds.includes(s.id));
      if (notOffered) {
        const message = `${professional.name} não realiza ${notOffered.name}.`;
        throw apiError("PROFESSIONAL_DOES_NOT_OFFER_SERVICE", message, {
          fields: [{ field: "serviceIds", message }],
          httpStatus: 422,
        });
      }

      const ts = nowIso();
      const series: RecurrenceSeries = {
        id: newId(),
        organizationId: payload.organizationId ?? store.organization.id,
        unitId: payload.unitId ?? store.unit.id,
        clientId: payload.clientId,
        professionalId: payload.professionalId,
        serviceIds: payload.serviceIds,
        frequency: payload.frequency,
        startDate: payload.startDate,
        time: payload.time,
        untilOccurrences: payload.untilOccurrences,
        untilDate: payload.untilDate,
        notes: payload.notes?.trim() || undefined,
        createdAt: ts,
        updatedAt: ts,
      };
      store.series.push(series);

      const dates = generateOccurrenceDates(series.frequency, series.startDate, {
        untilOccurrences: series.untilOccurrences,
        untilDate: series.untilDate,
      });
      const end = addMinutesToTime(
        series.time,
        found.reduce((sum, s) => sum + s.durationMinutes, 0),
      );
      const conflicts: { date: DateISO; code: SlotConflictCode }[] = [];
      let createdCount = 0;

      for (const date of dates) {
        const slot = checkSlotAvailability(date, series.time, end, slotContext(series.professionalId, date));
        if (!slot.ok) {
          conflicts.push({ date, code: slot.code });
          continue;
        }
        store.appointments.push({
          id: newId(),
          organizationId: series.organizationId,
          unitId: series.unitId,
          clientId: series.clientId,
          professionalId: series.professionalId,
          serviceIds: series.serviceIds,
          date,
          start: series.time,
          end,
          status: "pending",
          origin: "recurrence",
          notes: series.notes,
          seriesId: series.id,
          createdAt: ts,
          updatedAt: ts,
        });
        createdCount += 1;
      }

      return clone({ series, createdCount, conflicts });
    });
  },
};
