import type {
  Appointment,
  AppointmentFilter,
  AppointmentStatus,
  AppointmentView,
  CreateAppointment,
  DateISO,
  Id,
  RescheduleAppointment,
  Service,
  TimeISO,
  UpdateAppointment,
} from "@gestarahub/contracts";
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
} from "@gestarahub/core/scheduling";

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
    OUTSIDE_BUSINESS_HOURS: "Fora do horário de funcionamento da unidade nesta data.",
    OUTSIDE_PROFESSIONAL_HOURS: `${professionalName} não atende neste horário.`,
    ON_BREAK: `${professionalName} está em intervalo (almoço) neste horário.`,
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
  serviceIds: Id[];
  date: DateISO;
  start: TimeISO;
}

// Soma das duracoes dos servicos (ignora ids nao encontrados).
function totalDuration(serviceIds: Id[]): number {
  return serviceIds.reduce((sum, id) => {
    const s = store.services.find((x) => x.id === id);
    return sum + (s?.durationMinutes ?? 0);
  }, 0);
}

/**
 * Valida cliente/profissional/servico e a disponibilidade do slot (expediente +
 * bloqueio + sobreposicao). Retorna a duracao/fim derivados do servico.
 */
function resolveAndValidate(
  values: SlotValues,
  opts: { excludeId?: Id; allowBreak?: boolean },
) {
  const fields = [];
  if (!values.clientId) fields.push({ field: "clientId", message: "Selecione um cliente." });
  if (!values.professionalId) fields.push({ field: "professionalId", message: "Selecione um profissional." });
  if (!values.serviceIds || values.serviceIds.length === 0) {
    fields.push({ field: "serviceIds", message: "Selecione ao menos um serviço." });
  }
  if (!values.date) fields.push({ field: "date", message: "Selecione a data." });
  if (!values.start) fields.push({ field: "start", message: "Selecione o horário." });
  if (fields.length > 0) throw validationError(fields);

  const client = store.clients.find((c) => c.id === values.clientId);
  if (!client) throw validationError([{ field: "clientId", message: "Selecione um cliente." }]);
  const professional = store.professionals.find((p) => p.id === values.professionalId);
  if (!professional) throw validationError([{ field: "professionalId", message: "Selecione um profissional." }]);
  const services = values.serviceIds.map((id) => store.services.find((s) => s.id === id));
  if (services.some((s) => !s)) {
    throw validationError([{ field: "serviceIds", message: "Selecione ao menos um serviço." }]);
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
  // Qualquer profissional ativo pode realizar qualquer servico ativo — a
  // associacao profissional↔servico e apenas informativa (destaque na Agenda),
  // nao uma restricao.

  const end = addMinutesToTime(values.start, totalDuration(values.serviceIds));
  const ctx = slotContext(professional.id, values.date, opts.excludeId);
  const slot = checkSlotAvailability(values.date, values.start, end, ctx, {
    allowBreak: opts.allowBreak,
  });
  if (!slot.ok) throw slotError(slot.code, professional.name);

  return { end };
}

function toView(a: Appointment): AppointmentView {
  const client = store.clients.find((c) => c.id === a.clientId);
  const professional = store.professionals.find((p) => p.id === a.professionalId);
  const services = a.serviceIds.map((id) => {
    const s = store.services.find((x) => x.id === id);
    return {
      id,
      name: s?.name ?? "",
      durationMinutes: s?.durationMinutes ?? 0,
      priceCents: s?.priceCents ?? 0,
      status: s?.status ?? "inactive",
    };
  });
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
    services,
    totalDurationMinutes: services.reduce((sum, s) => sum + s.durationMinutes, 0),
    totalPriceCents: services.reduce((sum, s) => sum + s.priceCents, 0),
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

  create(
    payload: CreateAppointment,
    opts: { allowBreak?: boolean } = {},
  ): Promise<AppointmentView> {
    return simulateWrite(() => {
      const { end } = resolveAndValidate(payload, { allowBreak: opts.allowBreak });
      const ts = nowIso();
      const appointment: Appointment = {
        id: newId(),
        organizationId: payload.organizationId ?? store.organization.id,
        unitId: payload.unitId ?? store.unit.id,
        clientId: payload.clientId,
        professionalId: payload.professionalId,
        serviceIds: payload.serviceIds,
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

  update(
    id: Id,
    payload: UpdateAppointment,
    opts: { allowBreak?: boolean } = {},
  ): Promise<AppointmentView> {
    return simulateWrite(() => {
      const idx = store.appointments.findIndex((a) => a.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      const current = store.appointments[idx];
      const merged = { ...current, ...payload };
      const { end } = resolveAndValidate(merged, {
        excludeId: id,
        allowBreak: opts.allowBreak,
      });
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
      // Motivo opcional na remarcacao: guardado no rastro quando informado.
      const reason = payload.reason?.trim() || undefined;
      const idx = store.appointments.findIndex((a) => a.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      const current = store.appointments[idx];
      const merged = {
        clientId: current.clientId,
        serviceIds: current.serviceIds,
        professionalId: payload.professionalId ?? current.professionalId,
        date: payload.date ?? current.date,
        start: payload.start ?? current.start,
      };
      const { end } = resolveAndValidate(merged, { excludeId: id });
      const moved =
        merged.date !== current.date ||
        merged.start !== current.start ||
        merged.professionalId !== current.professionalId;
      const updated: Appointment = {
        ...current,
        professionalId: merged.professionalId,
        date: merged.date,
        start: merged.start,
        end,
        rescheduledFrom: moved
          ? [
              ...(current.rescheduledFrom ?? []),
              {
                date: current.date,
                start: current.start,
                professionalId: current.professionalId,
                reason,
              },
            ]
          : current.rescheduledFrom,
        updatedAt: nowIso(),
      };
      store.appointments[idx] = updated;
      return clone(toView(updated));
    });
  },

  /**
   * Remarca "esta e as futuras" ocorrencias de uma serie: aplica novo horario
   * e/ou profissional a partir desta ocorrencia (mantendo a data de cada uma).
   * Passadas/concluidas nao mudam; ocorrencias em conflito sao puladas.
   */
  rescheduleSeriesFuture(
    id: Id,
    payload: { start?: TimeISO; professionalId?: Id; reason?: string },
  ): Promise<{ updatedCount: number; conflicts: { date: DateISO; code: SlotConflictCode }[] }> {
    return simulateWrite(() => {
      const reason = payload.reason?.trim() || undefined;
      const occ = store.appointments.find((a) => a.id === id);
      if (!occ) throw notFoundError(NOT_FOUND);

      if (payload.professionalId) {
        const professional = store.professionals.find((p) => p.id === payload.professionalId);
        if (!professional) {
          throw validationError([{ field: "professionalId", message: "Selecione um profissional." }]);
        }
        if (professional.status !== "active") {
          throw apiError("PROFESSIONAL_INACTIVE", "Este profissional está inativo.", {
            fields: [{ field: "professionalId", message: "Este profissional está inativo." }],
            httpStatus: 422,
          });
        }
        // Associacao profissional↔servico e informativa: nao barra a remarcacao.
      }

      const targets = occ.seriesId
        ? store.appointments.filter(
            (a) => a.seriesId === occ.seriesId && a.date >= occ.date && occupies(a.status),
          )
        : [occ];

      const conflicts: { date: DateISO; code: SlotConflictCode }[] = [];
      let updatedCount = 0;
      for (const a of targets) {
        const professionalId = payload.professionalId ?? a.professionalId;
        const start = payload.start ?? a.start;
        const end = addMinutesToTime(start, totalDuration(a.serviceIds));
        const ctx = slotContext(professionalId, a.date, a.id);
        const slot = checkSlotAvailability(a.date, start, end, ctx);
        if (!slot.ok) {
          conflicts.push({ date: a.date, code: slot.code });
          continue;
        }
        const idx = store.appointments.findIndex((x) => x.id === a.id);
        const moved = professionalId !== a.professionalId || start !== a.start;
        store.appointments[idx] = {
          ...a,
          professionalId,
          start,
          end,
          rescheduledFrom: moved
            ? [
                ...(a.rescheduledFrom ?? []),
                { date: a.date, start: a.start, professionalId: a.professionalId, reason },
              ]
            : a.rescheduledFrom,
          updatedAt: nowIso(),
        };
        updatedCount += 1;
      }
      return clone({ updatedCount, conflicts });
    });
  },

  // Transicao de status (confirmar, iniciar, concluir, no-show). Sem checagem de
  // slot. Para cancelar, use `cancel` (exige motivo).
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

  // Cancelamento com motivo obrigatorio; o registro permanece no historico (doc 05).
  cancel(id: Id, reason: string): Promise<AppointmentView> {
    return simulateWrite(() => {
      const trimmed = reason?.trim();
      if (!trimmed) {
        throw validationError([{ field: "reason", message: "Informe o motivo do cancelamento." }]);
      }
      const idx = store.appointments.findIndex((a) => a.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      store.appointments[idx] = {
        ...store.appointments[idx],
        status: "canceled",
        cancellationReason: trimmed,
        updatedAt: nowIso(),
      };
      return clone(toView(store.appointments[idx]));
    });
  },

  // Marca como nao compareceu; o motivo e opcional e fica no historico (doc 05).
  markNoShow(id: Id, reason?: string): Promise<AppointmentView> {
    return simulateWrite(() => {
      const idx = store.appointments.findIndex((a) => a.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      store.appointments[idx] = {
        ...store.appointments[idx],
        status: "no_show",
        noShowReason: reason?.trim() || undefined,
        updatedAt: nowIso(),
      };
      return clone(toView(store.appointments[idx]));
    });
  },
};
