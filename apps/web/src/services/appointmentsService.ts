import type {
  Appointment,
  AppointmentFilter,
  AppointmentStatus,
  AppointmentView,
  CreateAppointment,
  DateISO,
  Id,
  RescheduleAppointment,
  TimeISO,
  UpdateAppointment,
} from "@/types";
import { store } from "@/mocks/store";
import {
  apiError,
  newId,
  notFoundError,
  nowIso,
  simulateRead,
  simulateWrite,
  textIncludes,
  validationError,
} from "@/mocks/helpers";
import {
  addMinutesToTime,
  checkSlotAvailability,
  type SlotConflictCode,
  type SlotContext,
} from "@/lib/scheduling";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const NOT_FOUND = "Agendamento não encontrado.";

// Status que ocupam a agenda do profissional (cancelado/no-show liberam o slot).
function occupies(status: AppointmentStatus): boolean {
  return status !== "canceled" && status !== "no_show";
}

// Monta o contexto do slot a partir do store (exclui o proprio na remarcacao).
function slotContext(
  professionalId: Id,
  date: DateISO,
  excludeId?: Id,
): SlotContext {
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
          a.id !== excludeId &&
          occupies(a.status),
      )
      .map((a) => ({ start: a.start, end: a.end })),
  };
}

// Erro de conflito de slot com a mensagem de referencia (doc 10).
function slotError(code: SlotConflictCode, professionalName: string) {
  const message: Record<SlotConflictCode, string> = {
    OUTSIDE_BUSINESS_HOURS: "Horário fora do expediente para esta data.",
    TIME_BLOCKED: "Este horário está bloqueado e não aceita agendamento.",
    OVERLAP_CONFLICT: `Este horário já está ocupado para ${professionalName}.`,
  };
  return apiError(code, message[code], {
    fields: [{ field: "start", message: message[code] }],
    httpStatus: 409,
  });
}

interface SlotValues {
  clientId: Id;
  professionalId: Id;
  serviceId: Id;
  date: DateISO;
  start: TimeISO;
}

/**
 * Valida cliente/profissional/servico e a disponibilidade do slot (expediente +
 * bloqueio + sobreposicao). Retorna a duracao/fim derivados do servico.
 */
function resolveAndValidate(values: SlotValues, opts: { excludeId?: Id }) {
  const fields = [];
  if (!values.clientId) fields.push({ field: "clientId", message: "Selecione um cliente." });
  if (!values.professionalId) fields.push({ field: "professionalId", message: "Selecione um profissional." });
  if (!values.serviceId) fields.push({ field: "serviceId", message: "Selecione um serviço." });
  if (!values.date) fields.push({ field: "date", message: "Selecione a data." });
  if (!values.start) fields.push({ field: "start", message: "Selecione o horário." });
  if (fields.length > 0) throw validationError(fields);

  const client = store.clients.find((c) => c.id === values.clientId);
  if (!client) throw validationError([{ field: "clientId", message: "Selecione um cliente." }]);
  const professional = store.professionals.find((p) => p.id === values.professionalId);
  if (!professional) throw validationError([{ field: "professionalId", message: "Selecione um profissional." }]);
  const service = store.services.find((s) => s.id === values.serviceId);
  if (!service) throw validationError([{ field: "serviceId", message: "Selecione um serviço." }]);

  if (professional.status !== "active") {
    throw apiError("PROFESSIONAL_INACTIVE", "Este profissional está inativo.", {
      fields: [{ field: "professionalId", message: "Este profissional está inativo." }],
      httpStatus: 422,
    });
  }
  if (service.status !== "active") {
    throw apiError("SERVICE_INACTIVE", "Este serviço está inativo.", {
      fields: [{ field: "serviceId", message: "Este serviço está inativo." }],
      httpStatus: 422,
    });
  }
  if (!professional.serviceIds.includes(service.id)) {
    const message = `${professional.name} não realiza este serviço.`;
    throw apiError("PROFESSIONAL_DOES_NOT_OFFER_SERVICE", message, {
      fields: [{ field: "serviceId", message }],
      httpStatus: 422,
    });
  }

  const end = addMinutesToTime(values.start, service.durationMinutes);
  const ctx = slotContext(professional.id, values.date, opts.excludeId);
  const slot = checkSlotAvailability(values.date, values.start, end, ctx);
  if (!slot.ok) throw slotError(slot.code, professional.name);

  return { end };
}

function toView(a: Appointment): AppointmentView {
  const client = store.clients.find((c) => c.id === a.clientId);
  const professional = store.professionals.find((p) => p.id === a.professionalId);
  const service = store.services.find((s) => s.id === a.serviceId);
  return {
    ...a,
    client: {
      id: a.clientId,
      name: client?.name ?? "",
      status: client?.status ?? "inactive",
    },
    professional: {
      id: a.professionalId,
      name: professional?.name ?? "",
      status: professional?.status ?? "inactive",
    },
    service: {
      id: a.serviceId,
      name: service?.name ?? "",
      durationMinutes: service?.durationMinutes ?? 0,
      priceCents: service?.priceCents ?? 0,
      status: service?.status ?? "inactive",
    },
  };
}

function matchesStatus(
  status: AppointmentStatus,
  filter: AppointmentStatus | AppointmentStatus[] | undefined,
): boolean {
  if (!filter) return true;
  return Array.isArray(filter) ? filter.includes(status) : status === filter;
}

export const appointmentsService = {
  list(filter?: AppointmentFilter): Promise<AppointmentView[]> {
    return simulateRead(() => {
      let result = store.appointments;
      if (filter?.dateFrom) result = result.filter((a) => a.date >= filter.dateFrom!);
      if (filter?.dateTo) result = result.filter((a) => a.date <= filter.dateTo!);
      if (filter?.professionalId) result = result.filter((a) => a.professionalId === filter.professionalId);
      if (filter?.clientId) result = result.filter((a) => a.clientId === filter.clientId);
      if (filter?.origin) result = result.filter((a) => a.origin === filter.origin);
      if (filter?.seriesId) result = result.filter((a) => a.seriesId === filter.seriesId);
      if (filter?.status) result = result.filter((a) => matchesStatus(a.status, filter.status));
      if (filter?.search) {
        const term = filter.search;
        result = result.filter((a) => {
          const client = store.clients.find((c) => c.id === a.clientId);
          return client ? textIncludes(client.name, term) : false;
        });
      }
      const sorted = [...result].sort(
        (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
      );
      return clone(sorted.map(toView));
    });
  },

  getById(id: Id): Promise<AppointmentView> {
    return simulateRead(() => {
      const found = store.appointments.find((a) => a.id === id);
      if (!found) throw notFoundError(NOT_FOUND);
      return clone(toView(found));
    });
  },

  create(payload: CreateAppointment): Promise<AppointmentView> {
    return simulateWrite(() => {
      const { end } = resolveAndValidate(payload, {});
      const ts = nowIso();
      const appointment: Appointment = {
        id: newId(),
        organizationId: payload.organizationId ?? store.organization.id,
        unitId: payload.unitId ?? store.unit.id,
        clientId: payload.clientId,
        professionalId: payload.professionalId,
        serviceId: payload.serviceId,
        date: payload.date,
        start: payload.start,
        end,
        status: payload.status ?? "pending",
        origin: "manual",
        notes: payload.notes?.trim() || undefined,
        seriesId: payload.seriesId,
        createdAt: ts,
        updatedAt: ts,
      };
      store.appointments.push(appointment);
      return clone(toView(appointment));
    });
  },

  update(id: Id, payload: UpdateAppointment): Promise<AppointmentView> {
    return simulateWrite(() => {
      const idx = store.appointments.findIndex((a) => a.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      const current = store.appointments[idx];
      const merged = { ...current, ...payload };
      const { end } = resolveAndValidate(merged, { excludeId: id });
      const updated: Appointment = {
        ...current,
        ...payload,
        end,
        notes: payload.notes !== undefined ? payload.notes.trim() || undefined : current.notes,
        updatedAt: nowIso(),
      };
      store.appointments[idx] = updated;
      return clone(toView(updated));
    });
  },

  reschedule(id: Id, payload: RescheduleAppointment): Promise<AppointmentView> {
    return simulateWrite(() => {
      const idx = store.appointments.findIndex((a) => a.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      const current = store.appointments[idx];
      const merged = {
        clientId: current.clientId,
        serviceId: current.serviceId,
        professionalId: payload.professionalId ?? current.professionalId,
        date: payload.date ?? current.date,
        start: payload.start ?? current.start,
      };
      const { end } = resolveAndValidate(merged, { excludeId: id });
      const updated: Appointment = {
        ...current,
        professionalId: merged.professionalId,
        date: merged.date,
        start: merged.start,
        end,
        updatedAt: nowIso(),
      };
      store.appointments[idx] = updated;
      return clone(toView(updated));
    });
  },

  // Transicao de status (confirmar, iniciar, concluir, cancelar, no-show). Sem
  // checagem de slot — cancelado permanece no historico.
  setStatus(id: Id, status: AppointmentStatus): Promise<AppointmentView> {
    return simulateWrite(() => {
      const idx = store.appointments.findIndex((a) => a.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      store.appointments[idx] = {
        ...store.appointments[idx],
        status,
        updatedAt: nowIso(),
      };
      return clone(toView(store.appointments[idx]));
    });
  },
};
