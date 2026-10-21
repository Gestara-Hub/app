import type {
  EnrollmentCourseChoice,
  EnrollmentView,
  Id,
  WaitlistEntry,
  WaitlistEntryView,
} from "@gestarahub/contracts";
import {
  apiError,
  newId,
  notFoundError,
  nowIso,
  simulateRead,
  simulateWrite,
  validationError,
} from "@/mocks/helpers";
import { store } from "@/mocks/store";
import { clone, studentName, activeEnrollments } from "./classShared";
import { syncTurmasFromDb } from "./classStore";
import { validateStudentScheduleConflict, resolveCourseChoice } from "./classValidation";
import { toEnrollmentView } from "./classViews";
import { createEnrollment, defaultPaysWithPackage } from "./enrollmentCreation";

// Renumera a fila (1..n) de quem ainda espera, na ordem atual.
async function renumberWaitlist(classGroupId: Id): Promise<void> {
  const waiting = store.waitlist
    .filter((w) => w.classGroupId === classGroupId && w.status === "waiting")
    .sort((a, b) => a.position - b.position);

  waiting.forEach((w, i) => {
    w.position = i + 1;
  });

}

export const waitlistService = {
  // --- Lista de espera ----------------------------------------------------
  listWaitlist(classGroupId: Id): Promise<WaitlistEntryView[]> {
    return simulateRead(async () => {
      await syncTurmasFromDb(store.organization.id);
      const rows = store.waitlist.filter(
        (w) => w.classGroupId === classGroupId && w.status === "waiting",
      );
      return clone(
        rows
          .sort((a, b) => a.position - b.position)
          .map((w) => ({ ...w, studentName: studentName(w.studentId) })),
      );
    });
  },

  addToWaitlist(input: {
    classGroupId: Id;
    studentId: Id;
  }): Promise<WaitlistEntryView> {
    return simulateWrite(async () => {
      const g = store.classGroups.find((x) => x.id === input.classGroupId);
      if (!g) throw notFoundError("Turma não encontrada.");
      const already = store.waitlist.find(
        (w) =>
          w.classGroupId === g.id &&
          w.studentId === input.studentId &&
          w.status === "waiting",
      );
      if (already) {
        throw validationError([
          { field: "studentId", message: "Aluno já está na lista de espera." },
        ]);
      }
      // Maior posicao + 1: nunca repete, mesmo apos remocoes/promocoes.
      const position =
        store.waitlist
          .filter((w) => w.classGroupId === g.id && w.status === "waiting")
          .reduce((max, w) => Math.max(max, w.position), 0) + 1;
      const entry: WaitlistEntry = {
        id: newId(),
        classGroupId: g.id,
        studentId: input.studentId,
        position,
        status: "waiting",
        createdAt: nowIso(),
      };

      store.waitlist.push(entry);
      return clone({ ...entry, studentName: studentName(input.studentId) });
    });
  },

  // Promove o aluno da espera para matricula (decisao manual; permite exceder a
  // capacidade, pois e uma acao consciente). Curso exige o pagamento escolhido.
  promoteFromWaitlist(id: Id, course?: EnrollmentCourseChoice): Promise<EnrollmentView> {
    return simulateWrite(async () => {
      const w = store.waitlist.find((x) => x.id === id);
      if (!w) throw notFoundError("Registro não encontrado.");
      // Guarda contra clique duplo: so promove quem ainda esta esperando.
      if (w.status !== "waiting") {
        throw apiError("VALIDATION", "Este aluno já saiu da lista de espera.", {
          httpStatus: 409,
        });
      }
      const g = store.classGroups.find((x) => x.id === w.classGroupId);
      if (!g) throw notFoundError("Turma não encontrada.");
      const student = store.clients.find((c) => c.id === w.studentId);
      if (!student) throw notFoundError("Aluno não encontrado.");
      if (student.status !== "active") {
        throw apiError("VALIDATION", `${student.name} está inativo. Reative o aluno antes de matricular.`, {
          httpStatus: 422,
        });
      }
      const already = activeEnrollments(g.id).some((e) => e.studentId === w.studentId);
      if (already) {
        throw apiError("VALIDATION", `${student.name} já está matriculado nesta turma.`, {
          httpStatus: 409,
        });
      }
      validateStudentScheduleConflict(w.studentId, g.id);
      const choice = resolveCourseChoice(g, course);

      w.status = "promoted";
      await renumberWaitlist(g.id);
      const enrollment = await createEnrollment(g, student.id, choice, defaultPaysWithPackage(g, student));
      return clone(toEnrollmentView(enrollment));
    });
  },

  removeFromWaitlist(id: Id): Promise<void> {
    return simulateWrite(async () => {
      const w = store.waitlist.find((x) => x.id === id);
      if (!w) throw notFoundError("Registro não encontrado.");

      w.status = "canceled";
      await renumberWaitlist(w.classGroupId);
    });
  },
};
