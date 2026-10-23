import type { Id, StudentSummary } from "@gestarahub/contracts";
import { daysUntilBirthday } from "@/lib/birthdays";
import { ageAt } from "@/lib/progression-tracks";
import { store } from "@/services/world/store";
import { notFoundError, readOp } from "@/services/world/ops";
import { ensureMembershipCharges } from "../billingService";
import { applyRecurringAutoPayments } from "../onlinePaymentsService";
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
      // Mesma leitura de Cobranças: mensalidades do mes nascem e o Pix Automatico paga.
      await ensureMembershipCharges();
      applyRecurringAutoPayments();

      const today = todayISO();
      const charges = store.charges.filter((c) => c.studentId === studentId);
      const attendances = attendancesOf(studentId);
      const enrollments = enrollmentsOf(studentId, charges, attendances, today);
      const lastMessages = (store.messageLogs ?? [])
        .filter((m) => m.clientId === studentId)
        .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
        .slice(0, LAST_MESSAGES);

      return structuredClone({
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
    });
  },
};

/** Conta real no navegador: roda no servidor sobre o banco (doc 15, fatia 2). */
export const studentSummaryService = delegateAll("studentSummary", studentSummaryServiceImpl);
