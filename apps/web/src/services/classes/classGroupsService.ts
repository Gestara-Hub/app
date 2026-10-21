import type {
  ClassGroup,
  ClassGroupFilter,
  ClassGroupView,
  CreateClassGroup,
  Id,
  UpdateClassGroup,
} from "@gestarahub/contracts";
import { plural } from "@gestarahub/core/format";
import { findInstructorConflicts, instructorConflictMessage } from "@gestarahub/core/scheduling";
import { addDays, format, parseISO } from "date-fns";
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
import { store } from "@/mocks/store";
import { auditLogService } from "../auditLogService";
import { cancelOnlinePaymentsForCharge } from "../onlinePaymentsService";
import { actorTeacherId, teacherSeesClass } from "../teacherScope";
import { clone, todayISO, instructorName, SEP, parseSessionId, upcomingPeriod } from "./classShared";
import { syncTurmasFromDb } from "./classStore";
import { normalizeBilling, validateGroup, sameSlots } from "./classValidation";
import { toGroupView } from "./classViews";

export const classGroupsService = {
  list(filter?: ClassGroupFilter): Promise<ClassGroupView[]> {
    return simulateRead(async () => {
      await syncTurmasFromDb(store.organization.id);
      let result = store.classGroups;
      if (filter?.search) {
        const term = filter.search;
        result = result.filter((g) => textIncludes(g.name, term));
      }
      if (filter?.modalityId) {
        result = result.filter((g) => g.modalityId === filter.modalityId);
      }
      if (filter?.instructorId) {
        result = result.filter((g) => g.instructorId === filter.instructorId);
      }
      if (filter?.status) {
        result = result.filter((g) => g.status === filter.status);
      }
      // Professor: so as turmas em que e o titular.
      const teacherId = actorTeacherId();
      if (teacherId !== undefined) result = result.filter((g) => teacherSeesClass(g, teacherId));
      return clone(
        [...result]
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
          .map(toGroupView),
      );
    });
  },

  getById(id: Id): Promise<ClassGroupView> {
    return simulateRead(async () => {
      await syncTurmasFromDb(store.organization.id);
      const g = store.classGroups.find((x) => x.id === id);
      if (!g || !teacherSeesClass(g)) throw notFoundError("Turma não encontrada.");
      return clone(toGroupView(g));
    });
  },

  create(input: CreateClassGroup): Promise<ClassGroupView> {
    return simulateWrite(async () => {
      const payload = normalizeBilling(input);
      validateGroup(payload, undefined);
      const ts = nowIso();
      const g: ClassGroup = {
        ...payload,
        organizationId: store.organization.id,
        unitId: store.unit.id,
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
      };

      store.classGroups.push(g);
      auditLogService.record({
        action: "created",
        target: { type: "class_group", id: g.id, label: g.name },
        predicate: `criou a turma ${g.name}`,
      });
      return clone(toGroupView(g));
    });
  },

  update(id: Id, payload: UpdateClassGroup): Promise<ClassGroupView> {
    return simulateWrite(async () => {
      const idx = store.classGroups.findIndex((x) => x.id === id);
      if (idx === -1) throw notFoundError("Turma não encontrada.");
      // Mudar a forma ou o valor nao mexe nas parcelas das matriculas ja feitas.
      const current = store.classGroups[idx];
      const next = normalizeBilling({ ...current, ...payload });
      validateGroup(next, id);
      // Novo horario vale daqui para frente: a grade antiga fica para as aulas
      // passadas (e para as de hoje, se a chamada de hoje ja foi feita).
      if (payload.meetingSlots && !sameSlots(current.meetingSlots, payload.meetingSlots)) {
        const today = todayISO();
        const todayHasRecords = store.attendances.some((a) =>
          a.sessionId.startsWith(`${id}${SEP}${today}${SEP}`),
        );
        const until = todayHasRecords ? today : format(addDays(parseISO(today), -1), "yyyy-MM-dd");
        const history = current.scheduleHistory ?? [];
        if (current.startDate <= until && !history.some((v) => v.until >= until)) {
          next.scheduleHistory = [...history, { until, meetingSlots: current.meetingSlots }];
        }
      }

      store.classGroups[idx] = {
        ...next,
        updatedAt: nowIso(),
      };
      auditLogService.record({
        action: "updated",
        target: { type: "class_group", id, label: store.classGroups[idx].name },
        predicate: `atualizou a turma ${store.classGroups[idx].name}`,
      });
      return clone(toGroupView(store.classGroups[idx]));
    });
  },

  // Desativa uma turma (soft delete): preserva histórico, impede novas sessões.
  deactivate(id: Id): Promise<ClassGroupView> {
    return simulateWrite(async () => {
      const idx = store.classGroups.findIndex((x) => x.id === id);
      if (idx === -1) throw notFoundError("Turma não encontrada.");
      const g = store.classGroups[idx];
      if (g.status === "inactive") {
        throw validationError([
          { field: "status", message: "Turma já foi desativada." },
        ]);
      }

      store.classGroups[idx] = {
        ...g,
        status: "inactive",
        updatedAt: nowIso(),
      };
      // Sem aulas daqui para frente: reservas futuras saem, e a avulsa em aberto
      // delas tambem (cancelada pelo sistema, nao e perda).
      const today = todayISO();
      let canceledReservations = 0;
      for (const r of store.reservations) {
        const date = parseSessionId(r.sessionId)?.date;
        if (r.status !== "reserved" || !r.sessionId.startsWith(`${id}${SEP}`) || !date || date <= today) continue;
        r.status = "canceled";
        canceledReservations += 1;
        const chargeId = r.chargeId || r.cobrancaId;
        const charge = chargeId ? store.charges.find((c) => c.id === chargeId) : undefined;
        if (charge && (charge.status === "pending" || charge.status === "overdue")) {
          charge.status = "canceled";
          charge.canceledBy = "system";
          charge.notes = "Turma desativada";
          charge.updatedAt = nowIso();
          cancelOnlinePaymentsForCharge(charge.id);
        }
      }
      auditLogService.record({
        action: "inactivated",
        target: { type: "class_group", id, label: g.name },
        predicate: `desativou a turma ${g.name}${canceledReservations > 0 ? ` e cancelou ${plural(canceledReservations, "reserva futura", "reservas futuras")}` : ""}`,
      });
      return clone(toGroupView(store.classGroups[idx]));
    });
  },

  // Reativa uma turma desativada.
  reactivate(id: Id): Promise<ClassGroupView> {
    return simulateWrite(async () => {
      const idx = store.classGroups.findIndex((x) => x.id === id);
      if (idx === -1) throw notFoundError("Turma não encontrada.");
      const g = store.classGroups[idx];
      // Enquanto inativa, o horario pode ter sido ocupado por outra turma do instrutor.
      const [conflict] = findInstructorConflicts(
        g.meetingSlots,
        g.instructorId,
        store.classGroups,
        g.id,
        upcomingPeriod(g.startDate, g.endDate),
      );
      if (conflict) {
        throw apiError(
          "CLASS_SCHEDULE_CONFLICT",
          instructorConflictMessage(instructorName(g.instructorId) || "O instrutor", conflict),
          { httpStatus: 409 },
        );
      }

      store.classGroups[idx] = {
        ...g,
        status: "active",
        updatedAt: nowIso(),
      };
      auditLogService.record({
        action: "activated",
        target: { type: "class_group", id, label: g.name },
        predicate: `reativou a turma ${g.name}`,
      });
      return clone(toGroupView(store.classGroups[idx]));
    });
  },
};
