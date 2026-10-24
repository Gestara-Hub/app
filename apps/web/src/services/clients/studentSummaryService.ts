import type { Id, StudentSummary } from "@gestarahub/contracts";
import { daysUntilBirthday } from "@/lib/birthdays";
import { ageAt } from "@/lib/progression-tracks";
import { store } from "@/services/world/store";
import { apiError, notFoundError, readOp } from "@/services/world/ops";
import { actorTeacherId, teacherTeachesStudent } from "../classes/teacherScope";
import { ensureMembershipCharges } from "../billing";
import { applyRecurringAutoPayments } from "../onlinePayments";
import { delegateAll } from "../world/delegate";
import {
  LAST_MESSAGES,
  activePackagesOf,
  attendanceWindow,
  attendancesOf,
  enrollmentsOf,
  levelsOf,
  localDateOf,
  membershipOf,
  openBalanceOf,
  summaryWithoutMoney,
  todayISO,
} from "./studentSummaryRules";

/**
 * Resumo do aluno (ficha do aluno, doc 22 item 2): a leitura unica que a API
 * vai expor para a ficha e os apps. Composta so do que o store ja guarda.
 */

export const studentSummaryServiceImpl = {
  getStudentSummary(studentId: Id): Promise<StudentSummary> {
    return readOp(async () => {
      const client = store.clients.find((c) => c.id === studentId);
      if (!client) throw notFoundError("Aluno não encontrado.");
      // Professor: so aluno de turma dele, e sem dinheiro (a leitura abaixo ja nasce limpa).
      const teacherId = actorTeacherId();
      if (teacherId !== undefined && !teacherTeachesStudent(studentId, teacherId)) {
        throw apiError("FORBIDDEN", "Você só vê a ficha dos alunos das suas turmas.", { httpStatus: 403 });
      }
      // Mesma leitura de Cobranças: mensalidades do mes nascem e o Pix Automatico paga.
      if (teacherId === undefined) {
        await ensureMembershipCharges();
        applyRecurringAutoPayments();
      }

      const today = todayISO();
      const charges = store.charges.filter((c) => c.studentId === studentId);
      const attendances = attendancesOf(studentId);
      const enrollments = enrollmentsOf(studentId, charges, attendances, today);
      const lastMessages = (store.messageLogs ?? [])
        .filter((m) => m.clientId === studentId)
        .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
        .slice(0, LAST_MESSAGES);

      const summary: StudentSummary = structuredClone({
        student: client,
        age: ageAt(client.birthDate, today),
        daysToBirthday: client.birthDate ? daysUntilBirthday(client.birthDate, today) : null,
        studentSince: localDateOf(client.createdAt),
        membership: membershipOf(client, today),
        enrollments,
        openBalance: openBalanceOf(charges, today),
        attendance30d: attendanceWindow(attendances, today),
        levels: levelsOf(client, enrollments, today),
        packages: activePackagesOf(client, today),
        lastMessages,
      });
      return teacherId === undefined ? summary : summaryWithoutMoney(summary);
    });
  },
};

/** Conta real no navegador: roda no servidor sobre o banco (doc 15, fatia 2). */
export const studentSummaryService = delegateAll("studentSummary", studentSummaryServiceImpl);
