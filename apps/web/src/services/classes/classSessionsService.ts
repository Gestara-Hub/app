import type { ClassSessionDetail, DateISO, Id } from "@gestarahub/contracts";
import { meetingSlotsOn, weekdayOf } from "@gestarahub/core/scheduling";
import { notFoundError, simulateRead } from "@/mocks/helpers";
import { store } from "@/mocks/store";
import { actorTeacherId, teacherSeesSession } from "../teacherScope";
import { clone, makeSessionId, resolveSession, datesBetween } from "./classShared";
import {
  toSessionView,
  buildRoster,
  type ClassSessionListItem,
  buildSessionDetail,
} from "./classViews";

export const classSessionsService = {
  // --- Sessoes (geradas) + presenca --------------------------------------
  listSessions(filter: {
    classGroupId?: Id;
    dateFrom: DateISO;
    dateTo: DateISO;
  }): Promise<ClassSessionListItem[]> {
    return simulateRead(async () => {
      const groups = store.classGroups.filter(
        (g) =>
          g.status === "active" &&
          (!filter.classGroupId || g.id === filter.classGroupId),
      );
      const out: ClassSessionListItem[] = [];
      // Professor: aulas das turmas dele e as que ele substitui.
      const teacherId = actorTeacherId();
      for (const date of datesBetween(filter.dateFrom, filter.dateTo)) {
        const wd = weekdayOf(date);
        for (const g of groups) {
          if (date < g.startDate) continue;
          if (g.endDate && date > g.endDate) continue;
          for (const slot of meetingSlotsOn(g, date)) {
            if (slot.weekday !== wd) continue;
            if (!teacherSeesSession(g, makeSessionId(g.id, date, slot.start), teacherId)) continue;
            const view = toSessionView(g, date, slot);
            out.push({
              ...view,
              capacity: g.capacity,
              occupiedCount: buildRoster(g, view.id, date).length,
            });
          }
        }
      }
      return clone(
        out.sort(
          (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
        ),
      );
    });
  },

  getSession(id: Id): Promise<ClassSessionDetail> {
    return simulateRead(async () => {
      const { g } = resolveSession(id);
      if (!teacherSeesSession(g, id)) throw notFoundError("Aula não encontrada.");
      return clone(buildSessionDetail(id));
    });
  },
};
